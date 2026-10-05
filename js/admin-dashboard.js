const API_BASE_URL = (() => {
  const configured =
    window.__VY_API_BASE_URL__ ||
    document.querySelector('meta[name="api-base-url"]')?.content?.trim() ||
    "";
  if (configured) return configured.replace(/\/+$/, "");
  return window.location.protocol === "file:" ? "http://localhost:5000" : "";
})();
const ADMIN_TOKEN_KEY = "vyAdminToken";

function resolveApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

const loginPanel = document.getElementById("adminLoginPanel");
const dashboard = document.getElementById("adminDashboard");
const loginForm = document.getElementById("adminLoginForm");
const loginMessage = document.getElementById("adminLoginMessage");
const adminMessage = document.getElementById("adminMessage");
const bookingList = document.getElementById("adminAppointmentList");
const revenueTotal = document.getElementById("adminRevenueTotal");
const revenueTransactions = document.getElementById(
  "adminRevenueTransactions"
);
const revenueMessage = document.getElementById("adminRevenueMessage");
const portalAccessForm = document.getElementById("portalAccessForm");
const portalAccessMessage = document.getElementById("portalAccessMessage");
const portalAccessResult = document.getElementById("portalAccessResult");

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

function renderBookings(bookings) {
  bookingList.replaceChildren();
  if (bookings.length === 0) {
    bookingList.append(emptyState("No appointment bookings have been submitted yet."));
    return;
  }

  for (const booking of bookings) {
    const card = document.createElement("article");
    card.className = "portal-record";
    const top = document.createElement("div");
    top.className = "portal-record__top";
    const patient = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = booking.full_name;
    patient.append(title);
    addDetail(patient, "Patient ID", booking.patient_id);
    addDetail(patient, "Visit ID", booking.appointment_id);
    top.append(patient);

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
      `${formatDate(booking.appointment_date)} · ${booking.appointment_time}`
    );
    addDetail(card, "Appointment fee", formatMoney(booking.amount_paise));
    const whatsappStatusLabels = {
      queued: "Queued",
      sending: "Sending",
      failed: "Failed",
      not_configured: "Not configured",
      needs_review: "Needs review",
    };
    addDetail(
      card,
      "WhatsApp confirmation",
      booking.whatsapp_confirmation_consent
        ? whatsappStatusLabels[booking.whatsapp_confirmation_status] ||
            "Not sent"
        : "Not requested"
    );
    addDetail(card, "Address", booking.address);
    addDetail(card, "Reason for consultation", booking.appointment_reason);
    addDetail(card, "Request received", formatDate(booking.created_at?.slice(0, 10)));

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
      const treatmentId = `treatment-${booking.id}`;
      label.htmlFor = treatmentId;
      label.textContent = "Treatment details shown in the patient portal";
      const treatment = document.createElement("textarea");
      treatment.id = treatmentId;
      treatment.name = "treatment_details";
      treatment.maxLength = 2000;
      treatment.value = booking.patient_note || "";
      treatment.placeholder = "Add the treatment plan or visit notes for this patient";
      const save = document.createElement("button");
      save.className = "portal-button";
      save.type = "submit";
      save.textContent = "Save treatment details";
      form.append(label, treatment, save);
      form.addEventListener("submit", saveTreatment);
      card.append(form);
    }

    bookingList.append(card);
  }
}

async function loadBookings() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) return;
  setMessage(adminMessage, "Loading bookings…");
  try {
    const result = await request("/api/admin/bookings", { token });
    renderBookings(result.bookings || []);
    setMessage(adminMessage, "");
  } catch (error) {
    if (/admin session|authentication|required|access required/i.test(error.message)) {
      logout();
      setMessage(loginMessage, "Your admin session expired. Please sign in again.");
      return;
    }
    setMessage(adminMessage, error.message);
  }
}

async function loadRevenue() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) return;
  revenueTotal.textContent = "Loading…";
  revenueTransactions.textContent = "—";
  setMessage(revenueMessage, "");

  try {
    const result = await request("/api/admin/revenue", { token });
    revenueTotal.textContent = formatMoney(result.revenue.total_paise);
    revenueTransactions.textContent = String(
      result.revenue.paid_transactions
    );
  } catch (error) {
    revenueTotal.textContent = "Unavailable";
    revenueTransactions.textContent = "—";
    setMessage(revenueMessage, error.message);
    if (/admin session|authentication|required|access required/i.test(error.message)) {
      logout();
      setMessage(loginMessage, "Your admin session expired. Please sign in again.");
    }
  }
}

async function saveTreatment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const values = new FormData(form);
    await request(
      `/api/admin/appointments/${encodeURIComponent(form.dataset.appointmentId)}/treatment`,
      {
        token: sessionStorage.getItem(ADMIN_TOKEN_KEY),
        method: "PATCH",
        body: {
          treatment_details: String(values.get("treatment_details") || ""),
        },
      }
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
    const patientId = String(
      new FormData(portalAccessForm).get("patient_id") || ""
    )
      .trim()
      .toUpperCase();
    const result = await request(
      `/api/admin/patients/${encodeURIComponent(patientId)}/portal-access`,
      { token: sessionStorage.getItem(ADMIN_TOKEN_KEY), method: "POST" }
    );
    document.getElementById("portalAccessPin").textContent =
      result.patient.pin;
    portalAccessResult.hidden = false;
    portalAccessForm.reset();
    setMessage(portalAccessMessage, result.message, true);
  } catch (error) {
    setMessage(portalAccessMessage, error.message);
  } finally {
    button.disabled = false;
  }
}

function logout() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
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
    const password = new FormData(loginForm).get("password");
    const result = await request("/api/admin/login", {
      method: "POST",
      body: { password: String(password) },
    });
    sessionStorage.setItem(ADMIN_TOKEN_KEY, result.token);
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

if (sessionStorage.getItem(ADMIN_TOKEN_KEY)) {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  loadBookings();
  loadRevenue();
}
