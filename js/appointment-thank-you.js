const receiptStorageKey = "vyAppointmentReceipt";
const receiptMessage = document.getElementById("receiptMessage");
const receiptError = document.getElementById("receiptError");
const patientLoginDetails = document.getElementById("patientLoginDetails");
const receiptActions = document.getElementById("receiptActions");
const receiptContent = document.getElementById("receiptContent");
const saveAppointment = document.getElementById("saveAppointment");

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
      typeof receipt.appointment_id !== "string" ||
      typeof receipt.patient_name !== "string" ||
      typeof receipt.appointment_date !== "string" ||
      typeof receipt.appointment_time !== "string" ||
      typeof receipt.service_type !== "string" ||
      !Number.isFinite(Number(receipt.amount)) ||
      Number(receipt.amount) <= 0 ||
      receipt.payment_status !== "PAID"
    ) {
      throw new Error("Appointment confirmation details are incomplete");
    }

    document.getElementById("receiptEyebrow").textContent =
      "✓ Appointment confirmed";
    document.getElementById("receiptHeading").textContent =
      `Thank you, ${receipt.patient_name || "patient"}!`;
    document.getElementById("receiptPatientId").textContent = receipt.patient_id;
    document.getElementById("receiptCredentialPatientId").textContent =
      receipt.patient_id;
    document.getElementById("receiptPatientName").textContent =
      receipt.patient_name || "Patient";
    document.getElementById("receiptService").textContent =
      receipt.service_type || "Appointment";
    const appointmentDate = new Date(`${receipt.appointment_date}T00:00:00`);
    document.getElementById("receiptDate").textContent =
      receipt.appointment_date && !Number.isNaN(appointmentDate.getTime())
        ? new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }).format(appointmentDate)
        : "To be confirmed by the clinic";
    document.getElementById("receiptTime").textContent =
      receipt.appointment_time || "To be confirmed by the clinic";
    document.getElementById("receiptFee").textContent =
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: receipt.currency || "INR",
        maximumFractionDigits: 0,
      }).format(Number(receipt.amount || 0));
    document.getElementById("receiptPaymentStatus").textContent =
      receipt.payment_status || "PAID";
    document.getElementById("receiptAppointmentId").textContent =
      receipt.appointment_id;
    receiptContent.hidden = false;

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
      "Your appointment has been successfully booked.";
    patientLoginDetails.hidden = false;
    receiptActions.hidden = false;
    const isOnlineConsultation =
      receipt.service_type === "Online Consultation";
    document.getElementById("onlineConsultationNote").hidden =
      !isOnlineConsultation;
    document.getElementById("onlineNextStep").hidden =
      !isOnlineConsultation;
    document.getElementById("receiptPrintNote").hidden = false;

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

saveAppointment?.addEventListener("click", function () {
  window.print();
});
