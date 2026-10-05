require("dotenv").config({
  path: require("path").join(__dirname, ".env"),
});

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const Razorpay = require("razorpay");
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
  "https://drvishalyogi.in",
  "https://www.drvishalyogi.in",
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
app.use(express.json());

app.get("/api/health", (_req, res) => {
  return res.json({ success: true });
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required",
      });
    }

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
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

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

function normalizeWhatsAppNumber(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith("0")) {
    digits = `91${digits.slice(1)}`;
  }
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

async function sendAppointmentConfirmationWhatsApp({
  bookingId,
  booking,
}) {
  if (!booking.whatsapp_confirmation_consent) return "not_opted_in";

  const bookingRef = collections.bookings.doc(bookingId);
  const apiKey = process.env.WUAPI_API_KEY?.trim();
  const accountId = process.env.WUAPI_ACCOUNT_ID?.trim();
  if (!apiKey || !accountId) {
    await bookingRef.update({
      whatsapp_confirmation_status: "not_configured",
    });
    console.warn("Appointment WhatsApp is not configured", { bookingId });
    return "not_configured";
  }

  const to = normalizeWhatsAppNumber(booking.phone);
  if (!to) {
    await bookingRef.update({
      whatsapp_confirmation_status: "failed",
      whatsapp_confirmation_last_error: "Invalid phone number",
    });
    console.warn("Appointment WhatsApp number is invalid", { bookingId });
    return "failed";
  }

  const now = Date.now();
  const claim = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(bookingRef);
    if (!snapshot.exists || snapshot.data().payment_status !== "paid") {
      return { shouldSend: false, status: "not_confirmed" };
    }

    const current = snapshot.data();
    if (current.whatsapp_confirmation_status === "queued") {
      return { shouldSend: false, status: "queued" };
    }
    if (current.whatsapp_confirmation_status === "needs_review") {
      return { shouldSend: false, status: "needs_review" };
    }

    const firstAttemptValue = current.whatsapp_confirmation_started_at;
    const firstAttemptAt =
      firstAttemptValue && typeof firstAttemptValue.toDate === "function"
        ? firstAttemptValue.toDate()
        : firstAttemptValue instanceof Date
          ? firstAttemptValue
          : null;
    if (
      firstAttemptAt &&
      now - firstAttemptAt.getTime() >= 24 * 60 * 60 * 1000
    ) {
      transaction.update(bookingRef, {
        whatsapp_confirmation_status: "needs_review",
      });
      return { shouldSend: false, status: "needs_review" };
    }

    if (
      current.whatsapp_confirmation_status === "sending" &&
      firstAttemptAt &&
      now - firstAttemptAt.getTime() < 2 * 60 * 1000
    ) {
      return { shouldSend: false, status: "sending" };
    }

    transaction.update(bookingRef, {
      whatsapp_confirmation_status: "sending",
      whatsapp_confirmation_started_at:
        firstAttemptAt || FieldValue.serverTimestamp(),
      whatsapp_confirmation_last_attempt_at: FieldValue.serverTimestamp(),
    });
    return { shouldSend: true, status: "sending" };
  });

  if (!claim.shouldSend) return claim.status;

  const date = booking.appointment_date;
  const time = booking.appointment_time;
  const name = booking.full_name.replace(/\s+/g, " ").trim();
  const lines = [
    `Hello ${name}, your booking with Dr. Vishal Yogi is confirmed.`,
    `Name: ${name}`,
    `Appointment: ${date} at ${time}`,
    `Service: ${booking.service_type}`,
  ];
  if (booking.service_type === "Online Consultation") {
    lines.push(
      "Your online consultation link will be shared about one hour before your appointment."
    );
  }

  let response;
  try {
    response = await fetch("https://api.wuapi.dev/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `appointment-confirmation-${bookingId}`,
      },
      body: JSON.stringify({
        accountId,
        to,
        type: "text",
        text: lines.join("\n"),
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    await bookingRef.update({
      whatsapp_confirmation_status: "failed",
      whatsapp_confirmation_last_error: "Provider connection failed",
      whatsapp_confirmation_failed_at: FieldValue.serverTimestamp(),
    });
    console.error("Appointment WhatsApp request failed", {
      bookingId,
      error: error.message,
    });
    return "failed";
  }

  const responseText = await response.text();
  let providerResponse = {};
  if (responseText) {
    try {
      providerResponse = JSON.parse(responseText);
    } catch {
      providerResponse = {};
    }
  }
  if (!response.ok) {
    const providerCode =
      typeof providerResponse.code === "string"
        ? providerResponse.code
        : `HTTP ${response.status}`;
    await bookingRef.update({
      whatsapp_confirmation_status: "failed",
      whatsapp_confirmation_last_error: providerCode,
      whatsapp_confirmation_failed_at: FieldValue.serverTimestamp(),
    });
    console.error("Appointment WhatsApp was rejected", {
      bookingId,
      providerCode,
      requestId: response.headers.get("x-request-id"),
    });
    return "failed";
  }

  await bookingRef.update({
    whatsapp_confirmation_status: "queued",
    whatsapp_confirmation_provider_message_id:
      typeof providerResponse.id === "string" ? providerResponse.id : null,
    whatsapp_confirmation_queued_at: FieldValue.serverTimestamp(),
    whatsapp_confirmation_last_error: FieldValue.delete(),
  });
  return "queued";
}

function publicPatientId() {
  return `VY${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function publicAppointmentId() {
  return `APT${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
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
}) {
  const bookingRef = collections.bookings.doc(bookingId);
  const paymentRef = collections.payments.doc(paymentDocumentId);
  const newPatientRef = collections.patients.doc(crypto.randomUUID());
  const newCredentialRef = collections.credentials.doc(newPatientRef.id);
  const appointmentRef = collections.appointments.doc(crypto.randomUUID());
  const generatedPatientId = publicPatientId();
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
      let credentialSnapshot = null;
      if (booking.pin_issued && booking.patient_doc_id) {
        credentialSnapshot = await transaction.get(
          collections.credentials.doc(booking.patient_doc_id)
        );
      }
      if (booking.pin_issued && !credentialSnapshot?.exists) {
        throw new Error("Patient credential record not found");
      }

      if (booking.pin_issued) {
        transaction.update(
          collections.credentials.doc(booking.patient_doc_id),
          {
            pin_hash: pinHash,
            failed_attempts: 0,
            locked_until: null,
          }
        );
      }
      transaction.update(paymentRef, {
        razorpay_payment_id: razorpayPaymentId,
        paid_at: FieldValue.serverTimestamp(),
      });
      return {
        patient_id: booking.patient_id,
        appointment_id: booking.appointment_id,
        pin_issued: booking.pin_issued,
      };
    }

    if (
      booking.payment_status !== "pending" ||
      booking.razorpay_order_id !== razorpayOrderId ||
      booking.payment_id !== paymentDocumentId
    ) {
      throw new HttpError(409, "Booking is not awaiting payment");
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

    if (patientMatches.empty) {
      patientRef = newPatientRef;
      patientId = generatedPatientId;
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

    return {
      patient_id: patientId,
      appointment_id: generatedAppointmentId,
      pin_issued: pinIssued,
    };
  });
}

const adminLoginFailures = new Map();
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_FAILURES = 5;
const bookingOrderAttempts = new Map();
const BOOKING_ORDER_WINDOW_MS = 15 * 60 * 1000;
const BOOKING_ORDER_MAX_ATTEMPTS = 10;

app.post("/api/admin/login", async (req, res) => {
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
    const snapshot = await collections.appointments
      .where("appointment_date", "==", appointmentDate)
      .get();
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
    console.error("Appointment availability lookup error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load appointment availability",
    });
  }
});

app.post("/api/appointment/payment-order", async (req, res) => {
  const body = req.body || {};
  const servicePrices = {
    "Clinic Consultation": 300,
    "Home Physiotherapy": 700,
    "Online Consultation": 200,
  };
  const serviceType =
    typeof body.service_type === "string" ? body.service_type : "";
  const fullName =
    typeof body.full_name === "string" ? body.full_name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const reason =
    typeof body.appointment_reason === "string"
      ? body.appointment_reason.trim()
      : "";
  const appointmentDate =
    typeof body.appointment_date === "string" ? body.appointment_date : "";
  const appointmentTime =
    typeof body.appointment_time === "string" ? body.appointment_time : "";
  const ageValue =
    body.age === undefined || body.age === "" || body.age === null
      ? null
      : Number(body.age);

  if (
    !fullName ||
    fullName.length > 120 ||
    phone.length < 7 ||
    phone.length > 25 ||
    (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
    address.length > 500 ||
    reason.length > 2000 ||
    !Object.hasOwn(servicePrices, serviceType) ||
    !appointmentTimes(serviceType).includes(appointmentTime) ||
    (serviceType !== "Online Consultation" &&
      recurringBookedClinicTimes.has(appointmentTime)) ||
    !isValidAppointmentDate(appointmentDate) ||
    appointmentDate < clinicDateToday() ||
    (ageValue !== null &&
      (!Number.isInteger(ageValue) || ageValue < 1 || ageValue > 120)) ||
    (serviceType === "Home Physiotherapy" && !address)
  ) {
    return res.status(400).json({
      success: false,
      message: "Check the patient details and selected appointment slot",
    });
  }

  try {
    const appointmentSnapshot = await collections.appointments
      .where("appointment_date", "==", appointmentDate)
      .get();
    const slotIsBooked = appointmentSnapshot.docs.some((document) => {
      const appointment = document.data();
      return (
        appointment.appointment_time === appointmentTime &&
        appointment.status === "confirmed" &&
        appointment.payment_status === "paid"
      );
    });
    if (slotIsBooked) {
      return res.status(409).json({
        success: false,
        message: "That appointment slot has just been booked. Please choose another time.",
      });
    }
  } catch (error) {
    console.error("Appointment slot validation error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to confirm that appointment slot is available",
    });
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  for (const [knownIp, entry] of bookingOrderAttempts) {
    if (entry.expiresAt <= now) bookingOrderAttempts.delete(knownIp);
  }
  const attempts = bookingOrderAttempts.get(ip);
  if (attempts && attempts.count >= BOOKING_ORDER_MAX_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      message: "Too many booking attempts. Please try again in 15 minutes.",
    });
  }
  bookingOrderAttempts.set(ip, {
    count: (attempts?.count || 0) + 1,
    expiresAt: attempts?.expiresAt || now + BOOKING_ORDER_WINDOW_MS,
  });

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({
      success: false,
      message: "Online appointment payments are not configured on the server",
    });
  }

  const amountPaise = servicePrices[serviceType] * 100;
  const bookingRef = collections.bookings.doc(crypto.randomUUID());
  const paymentRef = collections.payments.doc(crypto.randomUUID());
  try {
    await bookingRef.create({
      full_name: fullName,
      phone,
      email: email || null,
      age: ageValue,
      address: address || null,
      appointment_reason: reason || null,
      service_type: serviceType,
      whatsapp_confirmation_consent:
        body.whatsapp_confirmation_consent === true,
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
    return res.status(500).json({
      success: false,
      message: "Could not save the appointment details. Please try again.",
    });
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
      },
    });
  } catch (error) {
    console.error("Appointment payment order creation error:", error);
    await bookingRef.delete();
    return res.status(502).json({
      success: false,
      message: "Razorpay could not start the appointment payment",
    });
  }

  try {
    await db.runTransaction(async (transaction) => {
      const bookingSnapshot = await transaction.get(bookingRef);
      if (!bookingSnapshot.exists) throw new Error("Appointment booking disappeared");
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
    });
  } catch (error) {
    console.error("Appointment order save error:", error);
    await bookingRef.delete();
    return res.status(500).json({
      success: false,
      message: "Could not save the appointment payment details",
    });
  }

  return res.status(201).json({
    success: true,
    booking_id: bookingRef.id,
    key_id: process.env.RAZORPAY_KEY_ID,
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
      return res.status(400).json({
        success: false,
        message: "Payment confirmation details are invalid",
      });
    }
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({
        success: false,
        message: "Razorpay credentials are not configured on the server",
      });
    }

    const bookingSnapshot = await collections.bookings.doc(booking_id).get();
    const booking = documentData(bookingSnapshot);
    if (!booking || booking.razorpay_order_id !== razorpay_order_id) {
      return res.status(404).json({
        success: false,
        message: "Appointment payment was not found",
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
      payment.order_id !== booking.razorpay_order_id ||
      payment.amount !== booking.amount_paise ||
      payment.currency !== "INR" ||
      payment.status !== "captured"
    ) {
      return res.status(409).json({
        success: false,
        message: "The appointment payment has not been confirmed as captured",
      });
    }

    const pin = String(crypto.randomInt(0, 10000)).padStart(4, "0");
    const pinHash = await argon2.hash(pin);
    const patientAccount = await finalizeAppointmentBooking({
      bookingId: booking.id,
      paymentDocumentId: booking.payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      pinHash,
    });
    let whatsappStatus;
    try {
      whatsappStatus = await sendAppointmentConfirmationWhatsApp({
        bookingId: booking.id,
        booking,
      });
    } catch (error) {
      console.error("Appointment confirmed, but WhatsApp notification failed", {
        bookingId: booking.id,
        error: error.message,
      });
      whatsappStatus = "tracking_failed";
    }

    return res.json({
      success: true,
      patient_id: patientAccount.patient_id,
      appointment_id: patientAccount.appointment_id,
      pin: patientAccount.pin_issued ? pin : null,
      existing_patient: !patientAccount.pin_issued,
      whatsapp_confirmation_status: whatsappStatus,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    console.error("Appointment payment confirmation error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to confirm the appointment payment",
    });
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

    const token = jwt.sign(
      {
        patient_id: patient.patient_id,
        patient_uuid: patientSnapshot.id,
        role: "patient",
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({
      success: true,
      message: "Login successful",
      token,
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

const PORT = process.env.PORT || 5000;

collections.patients
  .limit(1)
  .get()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Firestore startup check failed:", error);
    process.exitCode = 1;
  });
