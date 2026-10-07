const isFirebaseFunction = process.env.FIREBASE_FUNCTIONS === "true";
if (!isFirebaseFunction) {
  require("dotenv").config({
    path: require("path").join(__dirname, ".env"),
  });
}

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const Razorpay = require("razorpay");
const { getAuth } = require("firebase-admin/auth");
const {
  FieldValue,
  collections,
  db,
  documentData,
  getByField,
  getByFieldValues,
} = require("./firestore");

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = new Set([
  "https://vishalyogi.in",
  "https://www.vishalyogi.in",
  "https://drvishalyogi.in",
  "https://www.drvishalyogi.in",
  "https://dr-vishal-clinic.web.app",
  "https://dr-vishal-clinic.firebaseapp.com",
]);
for (const origin of (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((value) => value.trim().replace(/\/+$/, ""))
  .filter(Boolean)) {
  allowedOrigins.add(origin);
}
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.add("http://localhost:5000");
  allowedOrigins.add("http://127.0.0.1:5000");
  allowedOrigins.add("null");
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed"));
    },
  })
);
app.use(
  express.json({
    verify(req, _res, buffer) {
      req.rawBody = Buffer.from(buffer);
    },
  })
);

app.get("/api/health", async (_req, res) => {
  try {
    await collections.bookings.limit(1).get();
    return res.json({ success: true, database: "connected" });
  } catch (error) {
    console.error("API readiness database check failed:", {
      code: error?.code || "unknown",
      message: error?.message || "Unknown Firestore error",
    });
    return res.status(503).json({
      success: false,
      database: "unavailable",
      message:
        "Database unavailable. Check the Netlify Function credentials and Firestore IAM permissions.",
    });
  }
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Admin authentication required",
    });
  }

  if (isFirebaseFunction) {
    return getAuth()
      .verifyIdToken(authHeader.substring(7))
      .then((decoded) => {
        if (decoded.admin !== true) {
          return res.status(403).json({
            success: false,
            message: "Admin access required",
          });
        }
        req.admin = decoded;
        return next();
      })
      .catch(() =>
        res.status(401).json({
          success: false,
          message: "Invalid or expired admin session",
        })
      );
  }

  try {
    const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired admin session",
    });
  }
}

function requirePatientAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (isFirebaseFunction) {
    return getAuth()
      .verifyIdToken(authHeader.substring(7))
      .then((decoded) => {
        if (
          decoded.role !== "patient" ||
          typeof decoded.patient_uuid !== "string" ||
          decoded.uid !== decoded.patient_uuid
        ) {
          return res.status(403).json({
            success: false,
            message: "Patient access required",
          });
        }
        req.patient = decoded;
        return next();
      })
      .catch(() =>
        res.status(401).json({
          success: false,
          message: "Invalid or expired token",
        })
      );
  }

  try {
    const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
    if (decoded.role !== "patient") {
      return res.status(403).json({
        success: false,
        message: "Patient access required",
      });
    }

    req.patient = decoded;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

function getRazorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials are not configured");
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

function sendPaymentError(res, status, message) {
  return res.status(status).json({
    success: false,
    error: message,
    message,
  });
}

function publicAppointmentId() {
  return `APT${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function appointmentSlotId(appointmentDate, appointmentTime) {
  return crypto
    .createHash("sha256")
    .update(`${appointmentDate}|${appointmentTime}`)
    .digest("hex");
}

function encryptPin(pin) {
  const key = Buffer.from(process.env.PIN_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) {
    throw new Error("PIN_ENCRYPTION_KEY must encode exactly 32 random bytes");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

function decryptPin(encryptedPin) {
  const key = Buffer.from(process.env.PIN_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) {
    throw new Error("PIN_ENCRYPTION_KEY must encode exactly 32 random bytes");
  }
  const value = Buffer.from(encryptedPin, "base64");
  if (value.length < 29) throw new Error("Encrypted PIN is invalid");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, value.subarray(0, 12));
  decipher.setAuthTag(value.subarray(12, 28));
  return Buffer.concat([
    decipher.update(value.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}

async function consumeBookingPin(bookingId) {
  const bookingRef = collections.bookings.doc(bookingId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(bookingRef);
    if (!snapshot.exists || !snapshot.data().pin_ciphertext) return null;
    const pin = decryptPin(snapshot.data().pin_ciphertext);
    transaction.update(bookingRef, {
      pin_ciphertext: FieldValue.delete(),
      pin_delivered_at: FieldValue.serverTimestamp(),
    });
    return pin;
  });
}

function clinicDateToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidAppointmentDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function formatAppointmentTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 || 12;
  return `${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
}

function appointmentTimes(serviceType) {
  if (serviceType === "Online Consultation") {
    return Array.from({ length: 48 }, (_, index) =>
      formatAppointmentTime(index * 30)
    );
  }
  if (serviceType !== "Clinic Consultation" && serviceType !== "Home Physiotherapy") {
    return [];
  }

  return [
    ...Array.from({ length: 11 }, (_, index) =>
      formatAppointmentTime(7 * 60 + index * 30)
    ),
    ...Array.from({ length: 11 }, (_, index) =>
      formatAppointmentTime(18 * 60 + index * 30)
    ),
  ];
}

function normalizeAppointmentTime(value) {
  if (typeof value !== "string") return "";
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (!match) return "";
  const hour = Number(match[1]);
  if (hour < 1 || hour > 12) return "";
  return `${String(hour).padStart(2, "0")}:${match[2]} ${match[3].toUpperCase()}`;
}

const recurringBookedClinicTimes = new Set([
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
]);

function timestampDate(value) {
  return value && typeof value.toDate === "function" ? value.toDate() : null;
}

async function finalizeAppointmentBooking({
  bookingId,
  paymentDocumentId,
  razorpayOrderId,
  razorpayPaymentId,
  pinHash,
  pinCiphertext,
}) {
  const bookingRef = collections.bookings.doc(bookingId);
  const paymentRef = collections.payments.doc(paymentDocumentId);
  const newPatientRef = collections.patients.doc(crypto.randomUUID());
  const newCredentialRef = collections.credentials.doc(newPatientRef.id);
  const appointmentRef = collections.appointments.doc(crypto.randomUUID());
  const generatedAppointmentId = publicAppointmentId();

  return db.runTransaction(async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingRef);
    if (!bookingSnapshot.exists) {
      throw new HttpError(404, "Appointment payment was not found");
    }

    const booking = bookingSnapshot.data();
    if (booking.payment_status === "paid") {
      if (
        booking.razorpay_payment_id !== razorpayPaymentId ||
        booking.razorpay_order_id !== razorpayOrderId
      ) {
        throw new HttpError(409, "Booking was paid with a different payment");
      }

      const paymentSnapshot = await transaction.get(paymentRef);
      if (
        !paymentSnapshot.exists ||
        paymentSnapshot.data().booking_id !== bookingId ||
        paymentSnapshot.data().status !== "paid"
      ) {
        throw new Error("Appointment payment record not found");
      }
      return {
        patient_id: booking.patient_id,
        appointment_id: booking.appointment_id,
        pin_issued: false,
        already_paid: true,
        pin_ciphertext: booking.pin_ciphertext || null,
      };
    }

    if (
      booking.payment_status !== "pending" ||
      booking.razorpay_order_id !== razorpayOrderId ||
      booking.payment_id !== paymentDocumentId
    ) {
      throw new HttpError(409, "Booking is not awaiting payment");
    }

    const slotRef = collections.slotReservations.doc(
      appointmentSlotId(booking.appointment_date, booking.appointment_time)
    );
    const slotSnapshot = await transaction.get(slotRef);
    if (
      !slotSnapshot.exists ||
      slotSnapshot.data().booking_id !== bookingId
    ) {
      throw new HttpError(
        409,
        "The appointment slot is no longer reserved for this booking"
      );
    }
    const conflictingAppointments = await transaction.get(
      collections.appointments
        .where("appointment_date", "==", booking.appointment_date)
    );
    if (
      conflictingAppointments.docs.some((document) => {
        const appointment = document.data();
        return (
          appointment.appointment_time === booking.appointment_time &&
          appointment.status === "confirmed" &&
          appointment.payment_status === "paid"
        );
      })
    ) {
      throw new HttpError(409, "The appointment slot has already been booked");
    }

    const patientQuery = collections.patients
      .where("phone", "==", booking.phone)
      .limit(1);
    const patientMatches = await transaction.get(patientQuery);
    let patientRef;
    let patient;
    let credentialRef;
    let credentialSnapshot = null;
    let patientId;
    let pinIssued = false;
    let counterRef = null;
    let patientNumber = 0;

    if (patientMatches.empty) {
      patientRef = newPatientRef;
      counterRef = db.collection("system_counters").doc("patient_ids");
      const counterSnapshot = await transaction.get(counterRef);
      patientNumber = Number(counterSnapshot.data()?.value || 0);
      for (let attempt = 0; attempt < 100; attempt += 1) {
        patientNumber += 1;
        patientId = `VY${String(patientNumber).padStart(4, "0")}`;
        const existingId = await transaction.get(
          collections.patients.where("patient_id", "==", patientId).limit(1)
        );
        if (existingId.empty) break;
        if (attempt === 99) {
          throw new Error("Unable to allocate a unique patient ID");
        }
      }
      patient = {
        patient_id: patientId,
        full_name: booking.full_name,
        phone: booking.phone,
        email: booking.email || null,
        date_of_birth: null,
        address: booking.address || null,
        created_at: FieldValue.serverTimestamp(),
      };
      credentialRef = newCredentialRef;
      pinIssued = true;
    } else {
      patientRef = patientMatches.docs[0].ref;
      patient = patientMatches.docs[0].data();
      patientId = patient.patient_id;
      credentialRef = collections.credentials.doc(patientRef.id);
      credentialSnapshot = await transaction.get(credentialRef);
      if (!credentialSnapshot.exists) pinIssued = true;
    }

    const paymentSnapshot = await transaction.get(paymentRef);
    if (
      !paymentSnapshot.exists ||
      paymentSnapshot.data().booking_id !== bookingId ||
      paymentSnapshot.data().razorpay_order_id !== razorpayOrderId
    ) {
      throw new Error("Appointment payment record not found");
    }

    transaction.set(
      patientRef,
      {
        ...patient,
        patient_id: patientId,
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    if (pinIssued) {
      transaction.set(credentialRef, {
        pin_hash: pinHash,
        failed_attempts: 0,
        locked_until: null,
        created_at: FieldValue.serverTimestamp(),
      });
    }
    if (counterRef) {
      transaction.set(counterRef, { value: patientNumber });
    }

    transaction.create(appointmentRef, {
      appointment_id: generatedAppointmentId,
      patient_doc_id: patientRef.id,
      patient_id: patientId,
      appointment_date: booking.appointment_date,
      appointment_time: booking.appointment_time,
      service_type: booking.service_type,
      status: "confirmed",
      amount: booking.amount_paise / 100,
      payment_status: "paid",
      online_meeting_url: null,
      active_payment_id: null,
      created_at: FieldValue.serverTimestamp(),
    });
    transaction.update(bookingRef, {
      patient_doc_id: patientRef.id,
      patient_id: patientId,
      appointment_doc_id: appointmentRef.id,
      appointment_id: generatedAppointmentId,
      razorpay_payment_id: razorpayPaymentId,
      payment_status: "paid",
      pin_issued: pinIssued,
      ...(pinIssued && pinCiphertext
        ? { pin_ciphertext: pinCiphertext }
        : {}),
      paid_at: FieldValue.serverTimestamp(),
    });
    transaction.update(paymentRef, {
      patient_doc_id: patientRef.id,
      appointment_doc_id: appointmentRef.id,
      appointment_id: generatedAppointmentId,
      status: "paid",
      razorpay_payment_id: razorpayPaymentId,
      paid_at: FieldValue.serverTimestamp(),
    });
    transaction.update(slotRef, {
      status: "confirmed",
      appointment_id: generatedAppointmentId,
      patient_doc_id: patientRef.id,
      confirmed_at: FieldValue.serverTimestamp(),
    });

    return {
      patient_id: patientId,
      appointment_id: generatedAppointmentId,
      pin_issued: pinIssued,
      already_paid: false,
      pin_ciphertext: pinIssued ? pinCiphertext || null : null,
    };
  });
}

async function completeAppointmentPayment({
  bookingId,
  razorpayOrderId,
  razorpayPaymentId,
  deliverPin,
}) {
  const booking = documentData(await collections.bookings.doc(bookingId).get());
  if (!booking || booking.razorpay_order_id !== razorpayOrderId) {
    throw new HttpError(404, "Appointment payment was not found");
  }

  const payment = await getRazorpayClient().payments.fetch(razorpayPaymentId);
  if (
    payment.order_id !== booking.razorpay_order_id ||
    payment.amount !== booking.amount_paise ||
    payment.currency !== "INR" ||
    payment.status !== "captured"
  ) {
    throw new HttpError(
      409,
      "The appointment payment has not been confirmed as captured"
    );
  }

  const pin = String(crypto.randomInt(0, 10000)).padStart(4, "0");
  const pinHash = await argon2.hash(pin);
  const pinCiphertext = isFirebaseFunction ? encryptPin(pin) : null;
  const patientAccount = await finalizeAppointmentBooking({
    bookingId,
    paymentDocumentId: booking.payment_id,
    razorpayOrderId,
    razorpayPaymentId,
    pinHash,
    pinCiphertext,
  });

  let oneTimePin = null;
  if (deliverPin) {
    if (patientAccount.pin_ciphertext) {
      oneTimePin = await consumeBookingPin(bookingId);
    } else if (
      !isFirebaseFunction &&
      patientAccount.pin_issued &&
      !patientAccount.already_paid
    ) {
      oneTimePin = pin;
    }
  }

  return {
    patient_name: booking.full_name,
    patient_id: patientAccount.patient_id,
    appointment_id: patientAccount.appointment_id,
    appointment_date: booking.appointment_date,
    appointment_time: booking.appointment_time,
    service_type: booking.service_type,
    amount: booking.amount_paise / 100,
    currency: "INR",
    payment_status: "PAID",
    pin: oneTimePin,
    existing_patient: !oneTimePin,
  };
}

const bookingOrderAttempts = new Map();
const BOOKING_ORDER_WINDOW_MS = 15 * 60 * 1000;
const BOOKING_ORDER_MAX_ATTEMPTS = 10;
const adminLoginFailures = new Map();
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_FAILURES = 5;

app.post("/api/admin/login", async (req, res) => {
  if (isFirebaseFunction) {
    return res.status(410).json({
      success: false,
      message: "Sign in with Firebase Authentication",
    });
  }
  const { password } = req.body || {};
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
    return res.status(503).json({
      success: false,
      message: "Configure an admin password of at least 12 characters on the server",
    });
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  for (const [knownIp, entry] of adminLoginFailures) {
    if (entry.expiresAt <= now) adminLoginFailures.delete(knownIp);
  }
  const failure = adminLoginFailures.get(ip);
  if (failure && failure.count >= ADMIN_LOGIN_MAX_FAILURES) {
    return res.status(429).json({
      success: false,
      message: "Too many failed admin login attempts. Try again in 15 minutes.",
    });
  }

  if (typeof password !== "string") {
    return res.status(400).json({
      success: false,
      message: "Admin password is required",
    });
  }

  const suppliedHash = crypto.createHash("sha256").update(password).digest();
  const configuredHash = crypto
    .createHash("sha256")
    .update(process.env.ADMIN_PASSWORD)
    .digest();

  if (!crypto.timingSafeEqual(suppliedHash, configuredHash)) {
    const currentFailure = adminLoginFailures.get(ip);
    adminLoginFailures.set(ip, {
      count: (currentFailure?.count || 0) + 1,
      expiresAt: currentFailure?.expiresAt || now + ADMIN_LOGIN_WINDOW_MS,
    });
    return res.status(401).json({
      success: false,
      message: "Invalid admin password",
    });
  }

  adminLoginFailures.delete(ip);
  try {
    const token = jwt.sign(
      { role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({ success: true, token });
  } catch (error) {
    console.error("Admin login token error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to start admin session",
    });
  }
});

app.get("/api/admin/firestore-test", requireAdminAuth, async (req, res) => {
  try {
    const snapshot = await collections.patients.limit(1).get();
    return res.json({
      success: true,
      rowsFound: snapshot.size,
    });
  } catch (error) {
    console.error("Firestore connection test error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/test", requireAdminAuth, async (req, res) => {
  try {
    const snapshot = await collections.patients.limit(1).get();
    return res.json({
      success: true,
      message: "Firestore connected successfully",
      data: snapshot.docs.map((patient) => ({
        patient_id: patient.data().patient_id,
      })),
    });
  } catch (error) {
    console.error("Firestore connection test error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/appointment/availability", async (req, res) => {
  const appointmentDate = req.query.date;
  const serviceType = req.query.service_type;
  const times = appointmentTimes(serviceType);

  if (
    !isValidAppointmentDate(appointmentDate) ||
    appointmentDate < clinicDateToday() ||
    !times.length
  ) {
    return res.status(400).json({
      success: false,
      message: "Choose a valid date (today or later) and consultation type",
    });
  }

  try {
    const [snapshot, reservations] = await Promise.all([
      collections.appointments
        .where("appointment_date", "==", appointmentDate)
        .get(),
      collections.slotReservations
        .where("appointment_date", "==", appointmentDate)
        .get(),
    ]);
    const bookedTimes = new Set(
      snapshot.docs
        .map((document) => document.data())
        .filter(
          (appointment) =>
            appointment.status === "confirmed" &&
            appointment.payment_status === "paid" &&
            times.includes(appointment.appointment_time)
        )
        .map((appointment) => appointment.appointment_time)
    );
    const now = Date.now();
    for (const reservation of reservations.docs) {
      const value = reservation.data();
      const expiresAt =
        value.expires_at && typeof value.expires_at.toMillis === "function"
          ? value.expires_at.toMillis()
          : value.expires_at instanceof Date
            ? value.expires_at.getTime()
            : Number.POSITIVE_INFINITY;
      if (
        value.status === "confirmed" ||
        (value.status === "pending" && expiresAt > now)
      ) {
        bookedTimes.add(value.appointment_time);
      }
    }

    if (serviceType !== "Online Consultation") {
      recurringBookedClinicTimes.forEach((time) => bookedTimes.add(time));
    }

    return res.json({
      success: true,
      date: appointmentDate,
      service_type: serviceType,
      booked_times: [...bookedTimes],
    });
  } catch (error) {
    console.error("Appointment availability lookup error:", {
      code: error?.code || "unknown",
      message: error?.message || "Unknown Firestore error",
    });
    return res.status(503).json({
      success: false,
      message:
        "Appointment database unavailable. Check the Netlify Function credentials and Firestore IAM permissions.",
    });
  }
});

app.post("/api/appointment/payment-order", async (req, res) => {
  const body = req.body || {};
  const isDevelopment = process.env.NODE_ENV !== "production";
  const servicePrices = {
    "Clinic Consultation": 200,
    "Home Physiotherapy": 500,
    "Online Consultation": 200,
  };
  const serviceType =
    typeof body.service_type === "string" ? body.service_type : "";
  const fullName =
    [body.full_name, body.patient_name, body.patientName]
      .find((value) => typeof value === "string" && value.trim())
      ?.trim() || "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const reason =
    typeof body.appointment_reason === "string"
      ? body.appointment_reason.trim()
      : "";
  const appointmentDate =
    typeof body.appointment_date === "string" ? body.appointment_date : "";
  const appointmentTime = normalizeAppointmentTime(body.appointment_time);
  const ageValue =
    body.age === undefined || body.age === "" || body.age === null
      ? null
      : Number(body.age);

  if (isDevelopment) {
    console.info("[payments] appointment payment request received", {
      serviceType,
      appointmentDate,
      appointmentTime,
    });
  }

  const validationErrors = [];
  if (!fullName || fullName.length > 120) {
    validationErrors.push("Enter a patient name under 120 characters.");
  } else if (phone.length < 7 || phone.length > 25) {
    validationErrors.push("Enter a valid phone number.");
  } else if (
    email &&
    (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    validationErrors.push("Check the email address.");
  } else if (address.length > 500 || reason.length > 2000) {
    validationErrors.push("Some details are too long. Please shorten and try again.");
  } else if (!Object.hasOwn(servicePrices, serviceType)) {
    validationErrors.push("Choose a valid consultation type.");
  } else if (!appointmentTimes(serviceType).includes(appointmentTime)) {
    validationErrors.push("Choose an available appointment time again.");
  } else if (!isValidAppointmentDate(appointmentDate)) {
    validationErrors.push("Choose a valid appointment date.");
  } else if (appointmentDate < clinicDateToday()) {
    validationErrors.push("That appointment date has passed. Choose today or a future date.");
  } else if (
    ageValue !== null &&
    (!Number.isInteger(ageValue) || ageValue < 1 || ageValue > 120)
  ) {
    validationErrors.push("Enter an age from 1 to 120, or leave it blank.");
  } else if (serviceType === "Home Physiotherapy" && !address) {
    validationErrors.push("Enter the address for your home visit.");
  }

  if (validationErrors.length) {
    if (isDevelopment) {
      console.warn("[payments] appointment request validation failed", {
        serviceType,
        appointmentDate,
        appointmentTime,
        error: validationErrors[0],
      });
    }
    return sendPaymentError(
      res,
      400,
      validationErrors[0]
    );
  }

  if (
    serviceType !== "Online Consultation" &&
    recurringBookedClinicTimes.has(appointmentTime)
  ) {
    return sendPaymentError(
      res,
      409,
      "That appointment time is unavailable. Please choose another slot."
    );
  }

  try {
    const [appointmentSnapshot, slotSnapshot] = await Promise.all([
      collections.appointments
        .where("appointment_date", "==", appointmentDate)
        .get(),
      collections.slotReservations
        .doc(appointmentSlotId(appointmentDate, appointmentTime))
        .get(),
    ]);
    const slotIsBooked = appointmentSnapshot.docs.some((document) => {
      const appointment = document.data();
      return (
        appointment.appointment_time === appointmentTime &&
        appointment.status === "confirmed" &&
        appointment.payment_status === "paid"
      );
    }) ||
      (slotSnapshot.exists &&
        (slotSnapshot.data().status === "confirmed" ||
          (slotSnapshot.data().status === "pending" &&
            slotSnapshot.data().expires_at?.toDate?.().getTime() > Date.now())));
    if (slotIsBooked) {
      return sendPaymentError(
        res,
        409,
        "That appointment slot has just been booked. Please choose another time."
      );
    }
  } catch (error) {
    console.error("Appointment slot validation error:", {
      code: error?.code || "unknown",
      message: error?.message || "Unknown Firestore error",
    });
    return sendPaymentError(
      res,
      503,
      "Appointment database unavailable. Check the Netlify Function credentials and Firestore IAM permissions."
    );
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  for (const [knownIp, entry] of bookingOrderAttempts) {
    if (entry.expiresAt <= now) bookingOrderAttempts.delete(knownIp);
  }
  const attempts = bookingOrderAttempts.get(ip);
  if (attempts && attempts.count >= BOOKING_ORDER_MAX_ATTEMPTS) {
    return sendPaymentError(
      res,
      429,
      "Too many booking attempts. Please try again in 15 minutes."
    );
  }
  bookingOrderAttempts.set(ip, {
    count: (attempts?.count || 0) + 1,
    expiresAt: attempts?.expiresAt || now + BOOKING_ORDER_WINDOW_MS,
  });

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return sendPaymentError(
      res,
      503,
      "Online appointment payments are not configured on the server"
    );
  }

  const amountPaise = servicePrices[serviceType] * 100;
  if (isDevelopment) {
    console.info("[payments] creating appointment order", {
      serviceType,
      amount: amountPaise / 100,
      amountPaise,
      currency: "INR",
    });
  }
  const bookingRef = collections.bookings.doc(crypto.randomUUID());
  const paymentRef = collections.payments.doc(crypto.randomUUID());
  const slotRef = collections.slotReservations.doc(
    appointmentSlotId(appointmentDate, appointmentTime)
  );
  try {
    await bookingRef.create({
      full_name: fullName,
      phone,
      email: email || null,
      age: ageValue,
      address: address || null,
      appointment_reason: reason || null,
      service_type: serviceType,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      amount_paise: amountPaise,
      payment_status: "pending",
      razorpay_order_id: null,
      razorpay_payment_id: null,
      payment_id: paymentRef.id,
      pin_issued: false,
      created_at: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Appointment booking save error:", error);
    return sendPaymentError(
      res,
      500,
      "Could not save the appointment details. Please try again."
    );
  }

  let order;
  try {
    order = await getRazorpayClient().orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: bookingRef.id.replaceAll("-", "").slice(0, 40),
      notes: {
        booking_id: bookingRef.id,
        service_type: serviceType,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
      },
    });
  } catch (error) {
    console.error("Appointment payment order creation error:", {
      statusCode: error.statusCode || error.status,
      code: error.error?.code || error.code,
      description: error.error?.description || error.description,
    });
    await bookingRef.delete();
    return sendPaymentError(
      res,
      502,
      "Razorpay could not start the appointment payment"
    );
  }
  if (isDevelopment) {
    console.info("[payments] Razorpay order created", {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
    });
  }

  try {
    await db.runTransaction(async (transaction) => {
      const bookingSnapshot = await transaction.get(bookingRef);
      if (!bookingSnapshot.exists) throw new Error("Appointment booking disappeared");
      const [existingReservation, existingAppointments] = await Promise.all([
        transaction.get(slotRef),
        transaction.get(
          collections.appointments.where(
            "appointment_date",
            "==",
            appointmentDate
          )
        ),
      ]);
      const reservation = existingReservation.exists
        ? existingReservation.data()
        : null;
      const reservationExpiresAt =
        reservation?.expires_at &&
        typeof reservation.expires_at.toDate === "function"
          ? reservation.expires_at.toDate().getTime()
          : reservation?.expires_at instanceof Date
            ? reservation.expires_at.getTime()
            : Number.POSITIVE_INFINITY;
      const reservationIsActive =
        reservation?.status === "confirmed" ||
        (reservation?.status === "pending" &&
          reservationExpiresAt > Date.now());
      const appointmentIsBooked = existingAppointments.docs.some((document) => {
        const appointment = document.data();
        return (
          appointment.appointment_time === appointmentTime &&
          appointment.status === "confirmed" &&
          appointment.payment_status === "paid"
        );
      });
      if (reservationIsActive || appointmentIsBooked) {
        throw new HttpError(
          409,
          "That appointment slot has just been booked. Please choose another time."
        );
      }
      transaction.update(bookingRef, { razorpay_order_id: order.id });
      transaction.create(paymentRef, {
        context: "appointment_booking",
        booking_id: bookingRef.id,
        appointment_id: null,
        patient_doc_id: null,
        amount_paise: amountPaise,
        currency: "INR",
        status: "created",
        razorpay_order_id: order.id,
        razorpay_payment_id: null,
        created_at: FieldValue.serverTimestamp(),
        paid_at: null,
      });
      transaction.set(slotRef, {
        booking_id: bookingRef.id,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        service_type: serviceType,
        status: "pending",
        expires_at: new Date(Date.now() + BOOKING_ORDER_WINDOW_MS),
        created_at: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof HttpError) {
      await bookingRef.delete().catch((deleteError) => {
        console.error("Conflicting appointment cleanup failed:", deleteError);
      });
      return sendPaymentError(res, error.status, error.message);
    }
    console.error("Appointment order save error:", error);
    await bookingRef.delete();
    return sendPaymentError(
      res,
      500,
      "Could not save the appointment payment details"
    );
  }

  return res.status(201).json({
    success: true,
    booking_id: bookingRef.id,
    key_id: process.env.RAZORPAY_KEY_ID,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    order: {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    },
  });
});

app.post("/api/appointment/payment-complete", async (req, res) => {
  try {
    const {
      booking_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body || {};
    if (
      typeof booking_id !== "string" ||
      !/^[a-f\d-]{36}$/i.test(booking_id) ||
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string" ||
      !/^[a-f\d]{64}$/i.test(razorpay_signature)
    ) {
      return sendPaymentError(
        res,
        400,
        "Payment confirmation details are invalid"
      );
    }
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return sendPaymentError(
        res,
        503,
        "Razorpay credentials are not configured on the server"
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest();
    const receivedSignature = Buffer.from(razorpay_signature, "hex");
    if (!crypto.timingSafeEqual(expectedSignature, receivedSignature)) {
      return sendPaymentError(res, 400, "Razorpay payment signature is invalid");
    }

    const result = await completeAppointmentPayment({
      bookingId: booking_id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      deliverPin: true,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof HttpError) {
      return sendPaymentError(res, error.status, error.message);
    }
    console.error("Appointment payment confirmation error:", error);
    return sendPaymentError(
      res,
      500,
      "Unable to confirm the appointment payment"
    );
  }
});

app.post("/api/razorpay/webhook", async (req, res) => {
  const signature = req.get("x-razorpay-signature");
  const rawBody = req.rawBody;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (
    !Buffer.isBuffer(rawBody) ||
    typeof signature !== "string" ||
    !webhookSecret
  ) {
    return res.status(400).json({ success: false });
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest();
  const receivedSignature = /^[a-f\d]{64}$/i.test(signature)
    ? Buffer.from(signature, "hex")
    : Buffer.alloc(0);
  if (
    receivedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return res.status(401).json({ success: false });
  }

  try {
    const event = JSON.parse(rawBody.toString("utf8"));
    if (event.event !== "payment.captured") {
      return res.status(200).json({ received: true });
    }
    const payment = event.payload?.payment?.entity;
    if (
      !payment ||
      typeof payment.id !== "string" ||
      typeof payment.order_id !== "string"
    ) {
      return res.status(400).json({ success: false });
    }
    const order = await getRazorpayClient().orders.fetch(payment.order_id);
    const bookingId = order.notes?.booking_id;
    if (typeof bookingId !== "string") {
      return res.status(200).json({ received: true });
    }
    await completeAppointmentPayment({
      bookingId,
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      deliverPin: false,
    });
    return res.status(200).json({ received: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ success: false });
    }
    console.error("Razorpay webhook processing failed:", error);
    return res.status(500).json({ success: false });
  }
});

app.get("/api/admin/revenue", requireAdminAuth, async (_req, res) => {
  try {
    const snapshot = await collections.payments
      .where("status", "==", "paid")
      .get();
    const amounts = snapshot.docs.map((payment) =>
      Number(payment.get("amount_paise"))
    );
    if (amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0)) {
      throw new Error("A paid payment record has an invalid amount");
    }

    const totalPaise = amounts.reduce((total, amount) => total + amount, 0);
    if (!Number.isSafeInteger(totalPaise)) {
      throw new Error("The paid revenue total is outside the safe amount range");
    }

    return res.json({
      success: true,
      revenue: {
        total_paise: totalPaise,
        paid_transactions: amounts.length,
      },
    });
  } catch (error) {
    console.error("Admin revenue summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load the paid revenue summary",
    });
  }
});

app.get("/api/admin/bookings", requireAdminAuth, async (req, res) => {
  try {
    const snapshot = await collections.bookings
      .orderBy("created_at", "desc")
      .limit(200)
      .get();
    const bookings = snapshot.docs.map(documentData);
    const appointmentIds = [...new Set(
      bookings.map((booking) => booking.appointment_id).filter(Boolean)
    )];
    const treatments = appointmentIds.length
      ? await getByFieldValues("treatments", "appointment_id", appointmentIds)
      : [];
    const treatmentByAppointment = new Map(
      treatments.map((item) => [
        item.data().appointment_id,
        item.data().treatment_details || null,
      ])
    );

    return res.json({
      success: true,
      bookings: bookings.map((booking) => ({
        ...booking,
        patient_note: treatmentByAppointment.get(booking.appointment_id) || null,
      })),
    });
  } catch (error) {
    console.error("Admin booking list error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load appointment bookings",
    });
  }
});

app.patch(
  "/api/admin/appointments/:appointmentId/treatment",
  requireAdminAuth,
  async (req, res) => {
    const { treatment_details } = req.body || {};
    if (
      typeof treatment_details !== "string" ||
      treatment_details.trim().length > 2000
    ) {
      return res.status(400).json({
        success: false,
        message: "Treatment details must be 2,000 characters or fewer",
      });
    }

    try {
      const appointmentSnapshot = await getByField(
        "appointments",
        "appointment_id",
        req.params.appointmentId
      );
      if (!appointmentSnapshot) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found",
        });
      }
      const details = treatment_details.trim() || null;
      await collections.treatments.doc(appointmentSnapshot.id).set(
        {
          patient_doc_id: appointmentSnapshot.data().patient_doc_id,
          patient_id: appointmentSnapshot.data().patient_id,
          appointment_doc_id: appointmentSnapshot.id,
          appointment_id: req.params.appointmentId,
          treatment_details: details,
          status: "updated",
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return res.json({ success: true, treatment_details: details });
    } catch (error) {
      console.error("Treatment update error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to save treatment details",
      });
    }
  }
);

app.get("/api/admin/appointments", requireAdminAuth, async (req, res) => {
  try {
    const snapshot = await collections.appointments
      .orderBy("appointment_date", "desc")
      .limit(100)
      .get();
    const appointments = snapshot.docs.map(documentData);
    const patientRefs = appointments
      .map((appointment) => appointment.patient_doc_id)
      .filter(Boolean);
    const uniquePatientRefs = [...new Set(patientRefs)];
    const patientSnapshots = await Promise.all(
      uniquePatientRefs.map((id) => collections.patients.doc(id).get())
    );
    const patientById = new Map(
      patientSnapshots
        .filter((patient) => patient.exists)
        .map((patient) => [patient.id, documentData(patient)])
    );
    const appointmentIds = appointments
      .map((appointment) => appointment.appointment_id)
      .filter(Boolean);
    const paymentDocs = appointmentIds.length
      ? await getByFieldValues("payments", "appointment_id", appointmentIds)
      : [];
    const paymentsByAppointment = new Map();
    for (const paymentDoc of paymentDocs) {
      const payment = documentData(paymentDoc);
      const list = paymentsByAppointment.get(payment.appointment_id) || [];
      list.push(payment);
      paymentsByAppointment.set(payment.appointment_id, list);
    }
    const treatments = appointmentIds.length
      ? await getByFieldValues("treatments", "appointment_id", appointmentIds)
      : [];
    const treatmentByAppointment = new Map(
      treatments.map((item) => [
        item.data().appointment_id,
        item.data().treatment_details || null,
      ])
    );

    return res.json({
      success: true,
      appointments: appointments.map((appointment) => ({
        ...appointment,
        patient: patientById.get(appointment.patient_doc_id) || null,
        patient_note: treatmentByAppointment.get(appointment.appointment_id) || null,
        payments: paymentsByAppointment.get(appointment.appointment_id) || [],
      })),
    });
  } catch (error) {
    console.error("Admin appointments error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load appointments",
    });
  }
});

app.post(
  "/api/admin/appointments/:appointmentId/payment-requests",
  requireAdminAuth,
  async (req, res) => {
    try {
      const { amount, treatment_details } = req.body || {};
      const amountText = typeof amount === "number" ? String(amount) : amount;
      if (
        typeof amountText !== "string" ||
        !/^\d+(?:\.\d{1,2})?$/.test(amountText) ||
        typeof treatment_details !== "string" ||
        !treatment_details.trim() ||
        treatment_details.trim().length > 2000
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid amount and treatment details (up to 2,000 characters)",
        });
      }

      const amountPaise = Math.round(Number(amountText) * 100);
      if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) {
        return res.status(400).json({
          success: false,
          message: "The payment amount must be at least ₹1.00",
        });
      }

      const appointmentSnapshot = await getByField(
        "appointments",
        "appointment_id",
        req.params.appointmentId
      );
      if (!appointmentSnapshot) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found",
        });
      }
      const appointment = documentData(appointmentSnapshot);
      if (appointment.payment_status === "paid") {
        return res.status(409).json({
          success: false,
          message: "This appointment is already marked as paid",
        });
      }
      if (appointment.active_payment_id) {
        const activePayment = await collections.payments
          .doc(appointment.active_payment_id)
          .get();
        if (activePayment.exists && activePayment.data().status === "created") {
          return res.status(409).json({
            success: false,
            message: "There is already an active payment request for this visit",
          });
        }
      }
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        return res.status(503).json({
          success: false,
          message: "Razorpay credentials are not configured on the server",
        });
      }

      let order;
      try {
        order = await getRazorpayClient().orders.create({
          amount: amountPaise,
          currency: "INR",
          receipt: `vy-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`,
          notes: {
            appointment_id: appointment.appointment_id,
          },
        });
      } catch (error) {
        console.error("Razorpay order creation error:", error);
        return res.status(502).json({
          success: false,
          message: "Razorpay could not create the payment order",
        });
      }

      const paymentRef = collections.payments.doc(crypto.randomUUID());
      let savedPayment;
      try {
        await db.runTransaction(async (transaction) => {
          const currentAppointment = await transaction.get(appointmentSnapshot.ref);
          if (!currentAppointment.exists) {
            throw new HttpError(404, "Appointment not found");
          }
          const current = currentAppointment.data();
          if (current.payment_status === "paid") {
            throw new HttpError(409, "This appointment is already marked as paid");
          }
          if (current.active_payment_id) {
            const previous = await transaction.get(
              collections.payments.doc(current.active_payment_id)
            );
            if (previous.exists && previous.data().status === "created") {
              throw new HttpError(
                409,
                "There is already an active payment request for this visit"
              );
            }
          }
          const createdAt = FieldValue.serverTimestamp();
          savedPayment = {
            id: paymentRef.id,
            patient_doc_id: current.patient_doc_id,
            patient_id: current.patient_id,
            appointment_doc_id: appointmentSnapshot.id,
            appointment_id: current.appointment_id,
            amount_paise: amountPaise,
            currency: "INR",
            treatment_details: treatment_details.trim(),
            status: "created",
            razorpay_order_id: order.id,
            created_at: new Date().toISOString(),
          };
          transaction.create(paymentRef, {
            ...savedPayment,
            created_at: createdAt,
            paid_at: null,
          });
          transaction.update(appointmentSnapshot.ref, {
            amount: amountPaise / 100,
            payment_status: "pending",
            active_payment_id: paymentRef.id,
          });
        });
      } catch (error) {
        if (error instanceof HttpError) {
          return res.status(error.status).json({
            success: false,
            message: error.message,
          });
        }
        console.error("Payment request save error:", error);
        return res.status(500).json({
          success: false,
          message: "The payment order was created but could not be saved",
        });
      }

      return res.status(201).json({
        success: true,
        paymentRequest: savedPayment,
      });
    } catch (error) {
      console.error("Admin payment initiation error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to initiate payment",
      });
    }
  }
);

app.post(
  "/api/admin/patients/:patientId/portal-access",
  requireAdminAuth,
  async (req, res) => {
    try {
      const patientId = req.params.patientId.trim().toUpperCase();
      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: "Patient ID is required",
        });
      }

      const patientSnapshot = await getByField(
        "patients",
        "patient_id",
        patientId
      );
      if (!patientSnapshot) {
        return res.status(404).json({
          success: false,
          message: "Patient not found. Check the Patient ID and try again.",
        });
      }

      const pin = String(crypto.randomInt(0, 10000)).padStart(4, "0");
      const pinHash = await argon2.hash(pin);
      const patientRef = collections.patients.doc(patientSnapshot.id);
      const credentialRef = collections.credentials.doc(patientSnapshot.id);

      await db.runTransaction(async (transaction) => {
        const currentPatient = await transaction.get(patientRef);
        if (!currentPatient.exists) {
          throw new HttpError(404, "Patient record was not found");
        }

        const credentialSnapshot = await transaction.get(credentialRef);
        if (credentialSnapshot.exists) {
          throw new HttpError(
            409,
            "Patient login is already configured. This action does not reset an existing PIN."
          );
        }

        transaction.create(credentialRef, {
          pin_hash: pinHash,
          failed_attempts: 0,
          locked_until: null,
          created_at: FieldValue.serverTimestamp(),
        });
      });

      return res.json({
        success: true,
        message: "Patient login configured successfully",
        patient: {
          patient_id: patientSnapshot.get("patient_id"),
          pin,
        },
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }
      console.error("Patient portal access setup error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to configure patient portal access",
      });
    }
  }
);

app.post("/api/patient/create", requireAdminAuth, async (req, res) => {
  try {
    const {
      full_name,
      phone,
      email,
      date_of_birth,
      address,
    } = req.body || {};

    if (
      typeof full_name !== "string" ||
      !full_name.trim() ||
      typeof phone !== "string" ||
      !phone.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required",
      });
    }

    const pin = String(crypto.randomInt(0, 10000)).padStart(4, "0");
    const pinHash = await argon2.hash(pin);
    const patientRef = collections.patients.doc(crypto.randomUUID());
    const credentialRef = collections.credentials.doc(patientRef.id);

    const result = await db.runTransaction(async (transaction) => {
      const existingQuery = collections.patients
        .where("phone", "==", phone.trim())
        .limit(1);
      const existingSnapshot = await transaction.get(existingQuery);
      if (!existingSnapshot.empty) {
        const existingRef = existingSnapshot.docs[0].ref;
        const existing = existingSnapshot.docs[0].data();
        const existingCredentialRef = collections.credentials.doc(existingRef.id);
        const existingCredential = await transaction.get(existingCredentialRef);
        if (existingCredential.exists) {
          throw new HttpError(409, `Patient already exists|${existing.patient_id}`);
        }

        transaction.create(existingCredentialRef, {
          pin_hash: pinHash,
          failed_attempts: 0,
          locked_until: null,
          created_at: FieldValue.serverTimestamp(),
        });
        return {
          patient: existing,
          loginConfigured: true,
        };
      }

      const counterRef = db.collection("system_counters").doc("patient_ids");
      const counterSnapshot = await transaction.get(counterRef);
      const patientNumber = Number(counterSnapshot.data()?.value || 0) + 1;
      const patientId = `VY${String(patientNumber).padStart(4, "0")}`;
      const patientData = {
        patient_id: patientId,
        full_name: full_name.trim(),
        phone: phone.trim(),
        email: typeof email === "string" ? email.trim() || null : null,
        date_of_birth:
          typeof date_of_birth === "string" ? date_of_birth || null : null,
        address: typeof address === "string" ? address.trim() || null : null,
        created_at: FieldValue.serverTimestamp(),
      };
      transaction.set(counterRef, { value: patientNumber });
      transaction.create(patientRef, patientData);
      transaction.create(credentialRef, {
        pin_hash: pinHash,
        failed_attempts: 0,
        locked_until: null,
        created_at: FieldValue.serverTimestamp(),
      });
      return {
        patient: { ...patientData, patient_id: patientId },
        loginConfigured: false,
      };
    });

    return res.status(201).json({
      success: true,
      message: result.loginConfigured
        ? "Patient login configured successfully"
        : "Patient created successfully",
      patient: {
        patient_id: result.patient.patient_id,
        full_name: result.patient.full_name,
        phone: result.patient.phone,
        pin,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      const [message, patientId] = error.message.split("|");
      return res.status(error.status).json({
        success: false,
        message,
        ...(patientId ? { patient_id: patientId } : {}),
      });
    }
    console.error("Patient creation error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.post("/api/patient/login", async (req, res) => {
  try {
    const { patient_id, pin } = req.body || {};
    if (
      typeof patient_id !== "string" ||
      !patient_id.trim() ||
      typeof pin !== "string" ||
      !/^\d{4}$/.test(pin)
    ) {
      return res.status(400).json({
        success: false,
        message: "Patient ID and a 4-digit PIN are required",
      });
    }

    const patientSnapshot = await getByField(
      "patients",
      "patient_id",
      patient_id.trim()
    );
    if (!patientSnapshot) {
      return res.status(401).json({
        success: false,
        message: "Invalid Patient ID or PIN",
      });
    }

    const patient = documentData(patientSnapshot);
    const credentialRef = collections.credentials.doc(patientSnapshot.id);
    const loginResult = await db.runTransaction(async (transaction) => {
      const credentialSnapshot = await transaction.get(credentialRef);
      if (!credentialSnapshot.exists) return { configured: false };
      const credentials = credentialSnapshot.data();
      const lockedUntil = timestampDate(credentials.locked_until);
      if (lockedUntil && lockedUntil > new Date()) {
        return { configured: true, locked: true };
      }

      const validPin = await argon2.verify(credentials.pin_hash, pin);
      if (!validPin) {
        const attempts = (credentials.failed_attempts || 0) + 1;
        transaction.update(credentialRef, attempts >= 5
          ? {
              failed_attempts: 0,
              locked_until: new Date(Date.now() + 15 * 60 * 1000),
            }
          : { failed_attempts: attempts });
        return { configured: true, valid: false };
      }

      transaction.update(credentialRef, {
        failed_attempts: 0,
        locked_until: null,
        last_login_at: FieldValue.serverTimestamp(),
      });
      return { configured: true, valid: true };
    });

    if (!loginResult.configured) {
      return res.status(401).json({
        success: false,
        message:
          "Patient login is not configured. Please contact the clinic to set it up.",
      });
    }
    if (loginResult.locked) {
      return res.status(423).json({
        success: false,
        message: "Account temporarily locked. Please try again later.",
      });
    }
    if (!loginResult.valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid Patient ID or PIN",
      });
    }

    let token;
    if (isFirebaseFunction) {
      const auth = getAuth();
      try {
        await auth.getUser(patientSnapshot.id);
      } catch (error) {
        if (error.code !== "auth/user-not-found") throw error;
        await auth.createUser({ uid: patientSnapshot.id, disabled: false });
      }
      await auth.setCustomUserClaims(patientSnapshot.id, {
        patient_uuid: patientSnapshot.id,
        patient_id: patient.patient_id,
        role: "patient",
      });
      token = await auth.createCustomToken(patientSnapshot.id, {
        patient_uuid: patientSnapshot.id,
        patient_id: patient.patient_id,
        role: "patient",
      });
    } else {
      token = jwt.sign(
        {
          patient_id: patient.patient_id,
          patient_uuid: patientSnapshot.id,
          role: "patient",
        },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );
    }

    return res.json({
      success: true,
      message: "Login successful",
      ...(isFirebaseFunction ? { custom_token: token } : { token }),
      patient: {
        patient_id: patient.patient_id,
        full_name: patient.full_name,
        phone: patient.phone,
        email: patient.email,
        date_of_birth: patient.date_of_birth,
        address: patient.address,
      },
    });
  } catch (error) {
    console.error("Patient login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.get("/api/patient/me", requirePatientAuth, async (req, res) => {
  try {
    const patientSnapshot = await collections.patients
      .doc(req.patient.patient_uuid)
      .get();
    const patient = documentData(patientSnapshot);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    const appointmentSnapshot = await collections.appointments
      .where("patient_doc_id", "==", req.patient.patient_uuid)
      .get();
    const appointments = appointmentSnapshot.docs
      .map(documentData)
      .sort((left, right) =>
        `${right.appointment_date} ${right.appointment_time}`.localeCompare(
          `${left.appointment_date} ${left.appointment_time}`
        )
      );
    const appointmentIds = appointments
      .map((appointment) => appointment.appointment_id)
      .filter(Boolean);
    const treatmentDocs = appointmentIds.length
      ? await getByFieldValues("treatments", "appointment_id", appointmentIds)
      : [];
    const treatmentByAppointment = new Map(
      treatmentDocs.map((item) => [
        item.data().appointment_id,
        item.data().treatment_details || null,
      ])
    );

    return res.json({
      success: true,
      patient: {
        patient_id: patient.patient_id,
        full_name: patient.full_name,
        phone: patient.phone,
        email: patient.email,
        date_of_birth: patient.date_of_birth,
        address: patient.address,
      },
      appointments: appointments.map((appointment) => ({
        ...appointment,
        patient_note: treatmentByAppointment.get(appointment.appointment_id) || null,
      })),
    });
  } catch (error) {
    console.error("Patient dashboard error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.post(
  "/api/patient/payments/verify",
  requirePatientAuth,
  async (req, res) => {
    try {
      const {
        payment_request_id,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body || {};
      if (
        typeof payment_request_id !== "string" ||
        typeof razorpay_order_id !== "string" ||
        typeof razorpay_payment_id !== "string" ||
        typeof razorpay_signature !== "string" ||
        !/^[a-f\d]{64}$/i.test(razorpay_signature)
      ) {
        return res.status(400).json({
          success: false,
          message: "Payment verification details are invalid",
        });
      }
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        return res.status(503).json({
          success: false,
          message: "Razorpay credentials are not configured on the server",
        });
      }

      const paymentRef = collections.payments.doc(payment_request_id);
      const paymentSnapshot = await paymentRef.get();
      const paymentRequest = documentData(paymentSnapshot);
      if (
        !paymentRequest ||
        paymentRequest.patient_doc_id !== req.patient.patient_uuid
      ) {
        return res.status(404).json({
          success: false,
          message: "Payment request not found",
        });
      }
      if (paymentRequest.status === "paid") {
        return res.json({ success: true, message: "Payment already verified" });
      }
      if (
        paymentRequest.status !== "created" ||
        paymentRequest.razorpay_order_id !== razorpay_order_id
      ) {
        return res.status(409).json({
          success: false,
          message: "Payment request is no longer payable",
        });
      }

      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest();
      const receivedSignature = Buffer.from(razorpay_signature, "hex");
      if (!crypto.timingSafeEqual(expectedSignature, receivedSignature)) {
        return res.status(400).json({
          success: false,
          message: "Razorpay payment signature is invalid",
        });
      }

      const payment = await getRazorpayClient().payments.fetch(razorpay_payment_id);
      if (
        payment.order_id !== paymentRequest.razorpay_order_id ||
        payment.amount !== paymentRequest.amount_paise ||
        payment.currency !== paymentRequest.currency ||
        payment.status !== "captured"
      ) {
        return res.status(409).json({
          success: false,
          message: "Razorpay has not confirmed this payment as captured",
        });
      }

      await db.runTransaction(async (transaction) => {
        const currentPayment = await transaction.get(paymentRef);
        if (!currentPayment.exists) throw new HttpError(404, "Payment request not found");
        const current = currentPayment.data();
        if (
          current.patient_doc_id !== req.patient.patient_uuid ||
          current.razorpay_order_id !== razorpay_order_id
        ) {
          throw new HttpError(404, "Payment request not found");
        }
        if (current.status === "paid") return;
        if (current.status !== "created") {
          throw new HttpError(409, "Payment request is no longer payable");
        }

        const appointmentRef = collections.appointments.doc(
          current.appointment_doc_id
        );
        const appointmentSnapshot = await transaction.get(appointmentRef);
        if (
          !appointmentSnapshot.exists ||
          appointmentSnapshot.data().patient_doc_id !== req.patient.patient_uuid
        ) {
          throw new HttpError(
            500,
            "Payment was captured, but the appointment could not be updated"
          );
        }

        transaction.update(paymentRef, {
          status: "paid",
          razorpay_payment_id,
          paid_at: FieldValue.serverTimestamp(),
        });
        transaction.update(appointmentRef, {
          payment_status: "paid",
          active_payment_id: null,
        });
      });

      return res.json({
        success: true,
        message: "Payment verified successfully",
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }
      console.error("Patient payment verification error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to verify payment",
      });
    }
  }
);

app.post(
  "/api/patient/payments/failure",
  requirePatientAuth,
  async (req, res) => {
    try {
      const { payment_request_id, razorpay_order_id } = req.body || {};
      if (
        typeof payment_request_id !== "string" ||
        typeof razorpay_order_id !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message: "Payment failure details are invalid",
        });
      }
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        return res.status(503).json({
          success: false,
          message: "Razorpay credentials are not configured on the server",
        });
      }

      const paymentRef = collections.payments.doc(payment_request_id);
      const paymentRequest = documentData(await paymentRef.get());
      if (
        !paymentRequest ||
        paymentRequest.patient_doc_id !== req.patient.patient_uuid ||
        paymentRequest.razorpay_order_id !== razorpay_order_id
      ) {
        return res.status(404).json({
          success: false,
          message: "Payment request not found",
        });
      }
      if (paymentRequest.status !== "created") {
        return res.status(409).json({
          success: false,
          message: "Payment request is no longer active",
        });
      }

      const order = await getRazorpayClient().orders.fetch(razorpay_order_id);
      if (order.status === "paid" || !order.attempts) {
        return res.status(409).json({
          success: false,
          message: "Razorpay has not confirmed a failed payment attempt",
        });
      }

      await db.runTransaction(async (transaction) => {
        const currentPayment = await transaction.get(paymentRef);
        if (!currentPayment.exists || currentPayment.data().status !== "created") {
          throw new HttpError(409, "Payment request is no longer active");
        }
        if (
          currentPayment.data().patient_doc_id !== req.patient.patient_uuid ||
          currentPayment.data().razorpay_order_id !== razorpay_order_id
        ) {
          throw new HttpError(404, "Payment request not found");
        }
        const appointmentRef = collections.appointments.doc(
          currentPayment.data().appointment_doc_id
        );
        const appointmentSnapshot = await transaction.get(appointmentRef);
        transaction.update(paymentRef, {
          status: "failed",
          failed_at: FieldValue.serverTimestamp(),
        });
        if (
          appointmentSnapshot.exists &&
          appointmentSnapshot.data().active_payment_id === paymentRef.id
        ) {
          transaction.update(appointmentRef, { active_payment_id: null });
        }
      });

      return res.json({
        success: true,
        message: "Payment attempt marked as failed",
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }
      console.error("Patient payment failure update error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to update payment status",
      });
    }
  }
);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

app.use("/api", (_req, res) =>
  res.status(404).json({
    success: false,
    error: "API endpoint not found",
    message: "API endpoint not found",
  })
);

app.use((error, _req, res, _next) => {
  if (res.headersSent) return;
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (process.env.NODE_ENV !== "production") {
    console.error("API request failed:", error);
  }
  return res.status(status).json({
    success: false,
    error: status === 400 ? "Invalid request" : "Request could not be processed",
    message: status === 400 ? "Invalid request" : "Request could not be processed",
  });
});

module.exports = app;
