import { auth, db } from "../firebase-config.js";
import {
  getIdToken,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const loginPanel = document.getElementById("adminLoginPanel");
const dashboard = document.getElementById("adminDashboard");
const loginForm = document.getElementById("adminLoginForm");
const loginMessage = document.getElementById("adminLoginMessage");
const adminMessage = document.getElementById("adminMessage");
const bookingList = document.getElementById("adminAppointmentList");
const revenueTotal = document.getElementById("adminRevenueTotal");
const revenueTransactions = document.getElementById("adminRevenueTransactions");
const revenueMessage = document.getElementById("adminRevenueMessage");
const portalAccessForm = document.getElementById("portalAccessForm");
const portalAccessMessage = document.getElementById("portalAccessMessage");
const portalAccessResult = document.getElementById("portalAccessResult");

function setMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle("portal-message--success", success);
}

function formatDate(value) {
  if (!value) return "Date not set";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function formatMoney(paise) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

function addDetail(parent, label, value) {
  if (value === null || value === undefined || value === "") return;
  const line = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  line.append(strong, document.createTextNode(String(value)));
  parent.append(line);
}

function emptyState(message) {
  const element = document.createElement("p");
  element.className = "portal-empty";
  element.textContent = message;
  return element;
}

async function loadTreatmentNotes(bookings) {
  const ids = [...new Set(bookings.map((item) => item.appointment_id).filter(Boolean))];
  const notes = new Map();
  for (let offset = 0; offset < ids.length; offset += 30) {
    const snapshot = await getDocs(
      query(
        collection(db, "treatments"),
        where("appointment_id", "in", ids.slice(offset, offset + 30))
      )
    );
    for (const treatment of snapshot.docs) {
      notes.set(
        treatment.data().appointment_id,
        treatment.data().treatment_details || ""
      );
    }
  }
  return notes;
}

function renderBookings(bookings, treatmentNotes) {
  bookingList.replaceChildren();
  if (!bookings.length) {
    bookingList.append(emptyState("No appointment bookings have been submitted yet."));
    return;
  }

  for (const booking of bookings) {
    const card = document.createElement("article");
    card.className = "portal-record";
    const top = document.createElement("div");
    top.className = "portal-record__top";
    const identity = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = booking.full_name || "Appointment booking";
    identity.append(title);
    addDetail(identity, "Patient ID", booking.patient_id);
    addDetail(identity, "Visit ID", booking.appointment_id);
    top.append(identity);

    const badge = document.createElement("span");
    badge.className = `portal-badge${booking.payment_status === "paid" ? " portal-badge--paid" : ""}`;
    badge.textContent = booking.payment_status === "paid" ? "Paid" : "Awaiting payment";
    top.append(badge);
    card.append(top);

    addDetail(card, "Phone", booking.phone);
    addDetail(card, "Email", booking.email);
    addDetail(card, "Age", booking.age);
    addDetail(card, "Service", booking.service_type);
    addDetail(
      card,
      "Requested visit",
      `${formatDate(booking.appointment_date)} · ${booking.appointment_time || ""}`
    );
    addDetail(card, "Appointment fee", formatMoney(booking.amount_paise || 0));
    addDetail(card, "Address", booking.address);
    addDetail(card, "Reason for consultation", booking.appointment_reason);

    const phoneDigits = String(booking.phone || "").replace(/\D/g, "");
    const whatsappNumber =
      phoneDigits.length === 10
        ? `91${phoneDigits}`
        : phoneDigits.length === 11 && phoneDigits.startsWith("0")
          ? `91${phoneDigits.slice(1)}`
          : phoneDigits;
    if (whatsappNumber) {
      const whatsapp = document.createElement("a");
      whatsapp.className = "portal-button portal-button--quiet";
      whatsapp.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        `Hello ${booking.full_name}, this is Dr. Vishal Yogi Physiotherapy Clinic regarding your ${booking.service_type} appointment request for ${booking.appointment_date} at ${booking.appointment_time}.`
      )}`;
      whatsapp.target = "_blank";
      whatsapp.rel = "noopener noreferrer";
      whatsapp.textContent = "Contact patient on WhatsApp";
      const actions = document.createElement("div");
      actions.className = "portal-record__actions";
      actions.append(whatsapp);
      card.append(actions);
    }

    if (booking.payment_status === "paid" && booking.appointment_id) {
      const form = document.createElement("form");
      form.className = "portal-form";
      form.dataset.appointmentId = booking.appointment_id;
      const label = document.createElement("label");
      const fieldId = `treatment-${booking.id}`;
      label.htmlFor = fieldId;
      label.textContent = "Treatment details shown in the patient portal";
      const textarea = document.createElement("textarea");
      textarea.id = fieldId;
      textarea.name = "treatment_details";
      textarea.maxLength = 2000;
      textarea.value = treatmentNotes.get(booking.appointment_id) || "";
      textarea.placeholder = "Add the treatment plan or visit notes for this patient";
      const button = document.createElement("button");
      button.className = "portal-button";
      button.type = "submit";
      button.textContent = "Save treatment details";
      form.append(label, textarea, button);
      form.addEventListener("submit", saveTreatment);
      card.append(form);
    }
    bookingList.append(card);
  }
}

async function loadBookings() {
  if (!auth.currentUser) return;
  setMessage(adminMessage, "Loading bookings…");
  try {
    const snapshot = await getDocs(
      query(
        collection(db, "appointment_bookings"),
        orderBy("created_at", "desc"),
        limit(200)
      )
    );
    const bookings = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderBookings(bookings, await loadTreatmentNotes(bookings));
    setMessage(adminMessage, "");
  } catch (error) {
    setMessage(adminMessage, error.message);
  }
}

async function loadRevenue() {
  if (!auth.currentUser) return;
  revenueTotal.textContent = "Loading…";
  revenueTransactions.textContent = "—";
  setMessage(revenueMessage, "");
  try {
    const snapshot = await getDocs(
      query(collection(db, "payments"), where("status", "==", "paid"))
    );
    const total = snapshot.docs.reduce(
      (sum, item) => sum + Number(item.data().amount_paise || 0),
      0
    );
    revenueTotal.textContent = formatMoney(total);
    revenueTransactions.textContent = String(snapshot.size);
  } catch (error) {
    revenueTotal.textContent = "Unavailable";
    revenueTransactions.textContent = "—";
    setMessage(revenueMessage, error.message);
  }
}

async function saveTreatment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const appointmentSnapshot = await getDocs(
      query(
        collection(db, "appointments"),
        where("appointment_id", "==", form.dataset.appointmentId),
        limit(1)
      )
    );
    if (appointmentSnapshot.empty) throw new Error("Appointment not found");
    const appointment = appointmentSnapshot.docs[0];
    const details = String(new FormData(form).get("treatment_details") || "").trim();
    await setDoc(
      doc(db, "treatments", appointment.id),
      {
        patient_doc_id: appointment.data().patient_doc_id,
        patient_id: appointment.data().patient_id,
        appointment_doc_id: appointment.id,
        appointment_id: form.dataset.appointmentId,
        treatment_details: details || null,
        status: "updated",
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
    setMessage(adminMessage, "Treatment details saved for the patient portal.", true);
  } catch (error) {
    setMessage(adminMessage, error.message);
  } finally {
    button.disabled = false;
  }
}

async function configurePortalAccess(event) {
  event.preventDefault();
  const button = portalAccessForm.querySelector('button[type="submit"]');
  button.disabled = true;
  portalAccessResult.hidden = true;
  document.getElementById("portalAccessPin").textContent = "";
  setMessage(portalAccessMessage, "");
  try {
    const patientId = String(new FormData(portalAccessForm).get("patient_id") || "")
      .trim()
      .toUpperCase();
    const idToken = await getIdToken(auth.currentUser);
    const response = await fetch(
      `/api/admin/patients/${encodeURIComponent(patientId)}/portal-access`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      }
    );
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || `Request failed (HTTP ${response.status})`);
    }
    document.getElementById("portalAccessPin").textContent = result.patient.pin;
    portalAccessResult.hidden = false;
    portalAccessForm.reset();
    setMessage(portalAccessMessage, result.message, true);
  } catch (error) {
    setMessage(portalAccessMessage, error.message);
  } finally {
    button.disabled = false;
  }
}

async function logout() {
  await signOut(auth);
  dashboard.hidden = true;
  loginPanel.hidden = false;
  bookingList.replaceChildren();
  portalAccessResult.hidden = true;
  document.getElementById("portalAccessPin").textContent = "";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  setMessage(loginMessage, "");
  try {
    const values = new FormData(loginForm);
    const credential = await signInWithEmailAndPassword(
      auth,
      String(values.get("email") || "").trim(),
      String(values.get("password") || "")
    );
    const token = await getIdTokenResult(credential.user);
    if (token.claims.admin !== true) {
      await signOut(auth);
      throw new Error("This Firebase account is not authorized as clinic admin.");
    }
    document.getElementById("adminEmail").value = "";
    document.getElementById("adminPassword").value = "";
    loginPanel.hidden = true;
    dashboard.hidden = false;
    await Promise.all([loadBookings(), loadRevenue()]);
  } catch (error) {
    setMessage(loginMessage, error.message);
  } finally {
    button.disabled = false;
  }
});

document.getElementById("adminLogout").addEventListener("click", logout);
document.getElementById("refreshAppointments").addEventListener("click", () => {
  loadBookings();
  loadRevenue();
});
portalAccessForm.addEventListener("submit", configurePortalAccess);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    dashboard.hidden = true;
    loginPanel.hidden = false;
    return;
  }
  try {
    const token = await getIdTokenResult(user);
    if (token.claims.admin !== true) {
      await signOut(auth);
      setMessage(loginMessage, "This Firebase account is not authorized as clinic admin.");
      return;
    }
    loginPanel.hidden = true;
    dashboard.hidden = false;
    await Promise.all([loadBookings(), loadRevenue()]);
  } catch (error) {
    await signOut(auth);
    setMessage(loginMessage, error.message);
  }
});
