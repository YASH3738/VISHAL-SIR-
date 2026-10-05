const API_BASE_URL = (() => {
  const configured =
    window.__VY_API_BASE_URL__ ||
    document.querySelector('meta[name="api-base-url"]')?.content?.trim() ||
    "";
  if (configured) return configured.replace(/\/+$/, "");
  return window.location.protocol === "file:" ? "http://localhost:5000" : "";
})();
const PATIENT_TOKEN_KEY = "vyPatientToken";

function resolveApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

const loginPanel = document.getElementById("patientLoginPanel");
const dashboard = document.getElementById("patientDashboard");
const loginForm = document.getElementById("patientLoginForm");
const loginMessage = document.getElementById("loginMessage");
const dashboardMessage = document.getElementById("dashboardMessage");
const visitList = document.getElementById("visitList");
const patientStats = document.getElementById("patientStats");

async function request(path, { token, method = "GET", body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(resolveApiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        API_BASE_URL
          ? "Could not connect to the clinic server. Start the local clinic backend and try again."
          : "Could not connect to the clinic server. Please try again later or contact the clinic."
      );
    }
    throw error;
  }

  const responseText = await response.text();
  let data = {};
  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(
        `The clinic server returned an unreadable response (HTTP ${response.status}). Please contact the clinic.`
      );
    }
  }

  if (!response.ok || data.success === false) {
    throw new Error(
      data.message || data.error || `The request could not be completed (HTTP ${response.status})`
    );
  }
  return data;
}

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
  if (appointments.length === 0) {
    visitList.append(emptyState("Your visit details will appear here when the clinic adds them."));
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

async function loadDashboard() {
  const token = sessionStorage.getItem(PATIENT_TOKEN_KEY);
  if (!token) return;
  try {
    renderDashboard(await request("/api/patient/me", { token }));
  } catch (error) {
    sessionStorage.removeItem(PATIENT_TOKEN_KEY);
    dashboard.hidden = true;
    loginPanel.hidden = false;
    setMessage(loginMessage, error.message);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage(loginMessage, "");

  try {
    const formData = new FormData(loginForm);
    const result = await request("/api/patient/login", {
      method: "POST",
      body: {
        patient_id: String(formData.get("patient_id")).trim(),
        pin: String(formData.get("pin")),
      },
    });
    sessionStorage.setItem(PATIENT_TOKEN_KEY, result.token);
    document.getElementById("patientPin").value = "";
    renderDashboard(await request("/api/patient/me", { token: result.token }));
  } catch (error) {
    setMessage(loginMessage, error.message);
  } finally {
    submitButton.disabled = false;
  }
});

document.getElementById("patientLogout").addEventListener("click", () => {
  sessionStorage.removeItem(PATIENT_TOKEN_KEY);
  dashboard.hidden = true;
  loginPanel.hidden = false;
  loginForm.reset();
  setMessage(loginMessage, "");
});

loadDashboard();
