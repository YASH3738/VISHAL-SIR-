import { auth, db } from "../firebase-config.js";
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const loginPanel = document.getElementById("patientLoginPanel");
const dashboard = document.getElementById("patientDashboard");
const loginForm = document.getElementById("patientLoginForm");
const loginMessage = document.getElementById("loginMessage");
const dashboardMessage = document.getElementById("dashboardMessage");
const visitList = document.getElementById("visitList");
const patientStats = document.getElementById("patientStats");

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

function emptyState(message) {
  const element = document.createElement("p");
  element.className = "portal-empty";
  element.textContent = message;
  return element;
}

function addDetail(parent, label, value) {
  if (value === null || value === undefined || value === "") return;
  const line = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  line.append(strong, document.createTextNode(String(value)));
  parent.append(line);
}

function addBadge(parent, status) {
  const badge = document.createElement("span");
  const safeStatus = String(status || "unknown").toLowerCase();
  badge.className = `portal-badge${safeStatus === "paid" ? " portal-badge--paid" : ""}${safeStatus === "failed" ? " portal-badge--failed" : ""}`;
  badge.textContent = safeStatus.replaceAll("_", " ");
  parent.append(badge);
}

function renderStats(data) {
  const appointments = data.appointments || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = appointments.filter((appointment) => {
    const date = new Date(`${appointment.appointment_date}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date >= today;
  }).length;
  const stats = [
    ["Total visits", appointments.length],
    ["Upcoming visits", upcoming],
    ["Previous visits", appointments.length - upcoming],
  ];
  patientStats.replaceChildren();
  for (const [label, value] of stats) {
    const card = document.createElement("div");
    card.className = "portal-stat";
    const heading = document.createElement("span");
    heading.textContent = label;
    const total = document.createElement("strong");
    total.textContent = String(value);
    card.append(heading, total);
    patientStats.append(card);
  }
}

function renderVisits(data) {
  visitList.replaceChildren();
  const appointments = data.appointments || [];
  if (!appointments.length) {
    visitList.append(
      emptyState("Your visit details will appear here when the clinic adds them.")
    );
    return;
  }
  for (const appointment of appointments) {
    const card = document.createElement("article");
    card.className = "portal-record";
    const top = document.createElement("div");
    top.className = "portal-record__top";
    const title = document.createElement("h4");
    title.textContent = appointment.service_type || "Physiotherapy visit";
    const titleGroup = document.createElement("div");
    titleGroup.append(title);
    addDetail(titleGroup, "Visit ID", appointment.appointment_id);
    top.append(titleGroup);
    addBadge(top, appointment.status);
    card.append(top);
    addDetail(card, "Date", formatDate(appointment.appointment_date));
    addDetail(card, "Time", appointment.appointment_time);
    addDetail(card, "Payment", appointment.payment_status);
    addDetail(card, "Treatment & care plan", appointment.patient_note);
    if (appointment.online_meeting_url) {
      try {
        const meetingUrl = new URL(appointment.online_meeting_url);
        if (meetingUrl.protocol === "https:" || meetingUrl.protocol === "http:") {
          const link = document.createElement("a");
          link.className = "portal-button portal-button--quiet";
          link.href = meetingUrl.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Open online visit";
          const actions = document.createElement("div");
          actions.className = "portal-record__actions";
          actions.append(link);
          card.append(actions);
        }
      } catch {
        // Ignore malformed meeting links rather than rendering unsafe URLs.
      }
    }
    visitList.append(card);
  }
}

async function loadDashboard() {
  const user = auth.currentUser;
  if (!user) return;
  setMessage(dashboardMessage, "Loading your visits…");
  try {
    const [patientSnapshot, appointmentSnapshot, treatmentSnapshot] =
      await Promise.all([
        getDoc(doc(db, "patients", user.uid)),
        getDocs(
          query(
            collection(db, "appointments"),
            where("patient_doc_id", "==", user.uid),
            orderBy("appointment_date", "desc")
          )
        ),
        getDocs(
          query(
            collection(db, "treatments"),
            where("patient_doc_id", "==", user.uid)
          )
        ),
      ]);
    if (!patientSnapshot.exists()) throw new Error("Patient record not found.");
    const notes = new Map(
      treatmentSnapshot.docs.map((item) => [
        item.data().appointment_id,
        item.data().treatment_details || null,
      ])
    );
    const appointments = appointmentSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
      patient_note: notes.get(item.data().appointment_id) || null,
    }));
    renderDashboard({
      patient: patientSnapshot.data(),
      appointments,
    });
    setMessage(dashboardMessage, "");
  } catch (error) {
    setMessage(dashboardMessage, error.message);
  }
}

function renderDashboard(data) {
  document.getElementById("patientGreeting").textContent =
    `Welcome, ${data.patient.full_name}`;
  document.getElementById("patientIdentity").textContent =
    `Patient ID: ${data.patient.patient_id}`;
  renderStats(data);
  renderVisits(data);
  loginPanel.hidden = true;
  dashboard.hidden = false;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage(loginMessage, "");
  try {
    const formData = new FormData(loginForm);
    const response = await fetch("/api/patient/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: String(formData.get("patient_id")).trim(),
        pin: String(formData.get("pin")),
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.success || !result.custom_token) {
      throw new Error(result.message || `Sign-in failed (HTTP ${response.status})`);
    }
    await signInWithCustomToken(auth, result.custom_token);
    document.getElementById("patientPin").value = "";
    await loadDashboard();
  } catch (error) {
    setMessage(loginMessage, error.message);
  } finally {
    submitButton.disabled = false;
  }
});

document.getElementById("patientLogout").addEventListener("click", async () => {
  await signOut(auth);
  dashboard.hidden = true;
  loginPanel.hidden = false;
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    dashboard.hidden = true;
    loginPanel.hidden = false;
    return;
  }
  try {
    const tokenResult = await user.getIdTokenResult();
    if (
      tokenResult.claims.role !== "patient" ||
      tokenResult.claims.patient_uuid !== user.uid
    ) {
      await signOut(auth);
      setMessage(loginMessage, "This Firebase account is not linked to a patient portal.");
      return;
    }
    await loadDashboard();
  } catch (error) {
    setMessage(loginMessage, error.message);
  }
});
