const receiptStorageKey = "vyAppointmentReceipt";
const receiptMessage = document.getElementById("receiptMessage");
const receiptError = document.getElementById("receiptError");
const patientLoginDetails = document.getElementById("patientLoginDetails");
const receiptActions = document.getElementById("receiptActions");
const appointmentDetails = document.getElementById("appointmentDetails");

try {
  const receiptText = sessionStorage.getItem(receiptStorageKey);
  sessionStorage.removeItem(receiptStorageKey);

  if (!receiptText) {
    document.getElementById("receiptEyebrow").textContent =
      "Confirmation unavailable";
    document.getElementById("receiptHeading").textContent =
      "Let’s confirm your booking.";
    receiptMessage.textContent =
      "We couldn’t find a confirmed booking in this browser tab. Please contact the clinic to check your payment status.";
    receiptError.textContent = "Do not retry payment until the clinic confirms its status.";
  } else {
    const receipt = JSON.parse(receiptText);
    if (
      !receipt ||
      typeof receipt.patient_id !== "string" ||
      typeof receipt.appointment_id !== "string"
    ) {
      throw new Error("Appointment confirmation details are incomplete");
    }

    document.getElementById("receiptEyebrow").textContent =
      "Payment confirmed · appointment booked";
    document.getElementById("receiptPatientId").textContent = receipt.patient_id;
    document.getElementById("receiptService").textContent =
      receipt.service_type || "Appointment";
    document.getElementById("receiptDate").textContent =
      receipt.appointment_date || "To be confirmed by the clinic";
    document.getElementById("receiptTime").textContent =
      receipt.appointment_time || "To be confirmed by the clinic";
    document.getElementById("receiptAppointmentId").textContent =
      receipt.appointment_id;
    appointmentDetails.hidden = false;

    if (receipt.pin) {
      document.getElementById("receiptPin").textContent = receipt.pin;
      document.getElementById("receiptNote").textContent =
        "This PIN is shown only once. Save it now and use it with your Patient ID to sign in.";
    } else {
      document.getElementById("receiptPinLabel").textContent = "Existing patient account";
      document.getElementById("receiptPin").textContent = "Use your existing PIN";
      document.getElementById("receiptNote").textContent =
        "Your visit was added to your existing account. Use your current PIN to sign in.";
    }

    receiptMessage.textContent =
      `You’re all set! Your appointment ${receipt.appointment_id} is confirmed. We look forward to helping you move better.`;
    patientLoginDetails.hidden = false;
    receiptActions.hidden = false;
    document.getElementById("onlineConsultationNote").hidden =
      receipt.service_type !== "Online Consultation";

    const whatsappStatus = document.getElementById("receiptWhatsappStatus");
    const whatsappMessages = {
      queued: "Your WhatsApp appointment confirmation has been queued.",
      sending: "Your WhatsApp appointment confirmation is being prepared.",
      not_opted_in:
        "Your appointment is confirmed. WhatsApp confirmation was not requested.",
      not_configured:
        "Your appointment is confirmed. The clinic will follow up with your booking details.",
      failed:
        "Your appointment is confirmed. The WhatsApp message could not be queued; please contact the clinic if you need a copy.",
      needs_review:
        "Your appointment is confirmed. The clinic will verify your WhatsApp update.",
      tracking_failed:
        "Your appointment is confirmed. The clinic will follow up with your booking details.",
    };
    const whatsappMessage =
      whatsappMessages[receipt.whatsapp_confirmation_status];
    if (whatsappMessage) {
      whatsappStatus.textContent = whatsappMessage;
      whatsappStatus.classList.toggle(
        "portal-message--success",
        receipt.whatsapp_confirmation_status === "queued"
      );
      whatsappStatus.hidden = false;
    }

    const details = [
      `Appointment: ${receipt.appointment_id}`,
      `Patient: ${receipt.patient_id}`,
      `Service: ${receipt.service_type}`,
      `Date: ${receipt.appointment_date}`,
      `Time: ${receipt.appointment_time}`,
    ].join("\n");
    document.getElementById("whatsappReceipt").href =
      `https://wa.me/917014138261?text=${encodeURIComponent(details)}`;
  }
} catch (error) {
  console.error("Appointment receipt display error:", error);
  document.getElementById("receiptEyebrow").textContent =
    "Confirmation unavailable";
  document.getElementById("receiptHeading").textContent =
    "Let’s confirm your booking.";
  receiptMessage.textContent =
    "We couldn’t verify the booking details on this page. Please contact the clinic before making another payment.";
  receiptError.textContent =
    "Please contact the clinic and provide your payment receipt.";
}
