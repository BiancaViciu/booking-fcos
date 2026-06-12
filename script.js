const calendarGrid = document.querySelector("#calendarGrid");
const monthLabel = document.querySelector("#monthLabel");
const prevMonthButton = document.querySelector("#prevMonth");
const nextMonthButton = document.querySelector("#nextMonth");
const timeSlots = document.querySelector("#timeSlots");
const appointmentSummary = document.querySelector("#appointmentSummary");
const bookingForm = document.querySelector("#bookingForm");
const formStatus = document.querySelector("#formStatus");
const submitButton = document.querySelector("#submitButton");
const bookingPanel = document.querySelector(".booking-panel");
const receiptTemplate = document.querySelector("#bookingTemplate");

const defaultAvailability = {
  consultants: [
    {
      name: "Mihaela Pădure",
      online: {
        weekdays: [1, 2, 3, 4, 5],
        times: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"],
      },
      inPerson: {
        weekdays: [2, 3, 4],
        times: ["10:00", "11:00", "14:00", "15:00"],
      },
    },
  ],
};
const durationLabels = {
  15: "15 minutes - £140 + VAT",
  30: "30 minutes - £280 + VAT",
};
const today = startOfDay(new Date());

let currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = null;
let selectedTime = "";
let bookedSlots = [];
let availability = defaultAvailability;
let isSubmitting = false;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function isBooked(dateKey, time) {
  const mode = getSelectedMode();
  const consultant = getSelectedConsultant();

  return bookedSlots.some(
    (booking) =>
      booking.date === dateKey &&
      booking.time === time &&
      booking.appointmentMode === mode &&
      booking.consultant === consultant,
  );
}

function isUnavailableDate(date) {
  return date < today || !getModeWeekdays().includes(date.getDay());
}

function renderCalendar() {
  calendarGrid.innerHTML = "";

  const monthName = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(currentMonth);

  monthLabel.textContent = monthName;

  const firstWeekday = currentMonth.getDay();
  const lastDate = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0,
  ).getDate();

  for (let index = 0; index < firstWeekday; index += 1) {
    const spacer = document.createElement("span");
    spacer.className = "day-spacer";
    calendarGrid.appendChild(spacer);
  }

  for (let day = 1; day <= lastDate; day += 1) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const button = document.createElement("button");
    button.className = "day";
    button.type = "button";
    button.textContent = day;
    button.disabled = isUnavailableDate(date);
    button.setAttribute("aria-label", formatDate(date));

    if (toDateKey(date) === toDateKey(today)) {
      button.classList.add("is-today");
    }

    if (selectedDate && toDateKey(date) === toDateKey(selectedDate)) {
      button.classList.add("is-selected");
      button.setAttribute("aria-pressed", "true");
    } else {
      button.setAttribute("aria-pressed", "false");
    }

    button.addEventListener("click", () => {
      selectedDate = date;
      selectedTime = "";
      formStatus.textContent = "";
      renderCalendar();
      renderSlots();
      updateSummary();
      updatePaymentButtonState();
    });

    calendarGrid.appendChild(button);
  }
}

function renderSlots() {
  timeSlots.innerHTML = "";
  const availableTimes = getModeTimes();

  if (!selectedDate) {
    availableTimes.forEach((time) => {
      const button = createSlotButton(time);
      button.disabled = true;
      timeSlots.appendChild(button);
    });
    return;
  }

  const dateKey = toDateKey(selectedDate);

  availableTimes.forEach((time) => {
    const button = createSlotButton(time);
    button.disabled = isBooked(dateKey, time);

    if (time === selectedTime) {
      button.classList.add("is-selected");
    }

    button.addEventListener("click", () => {
      selectedTime = time;
      formStatus.textContent = "";
      renderSlots();
      updateSummary();
      updatePaymentButtonState();
    });

    timeSlots.appendChild(button);
  });
}

function createSlotButton(time) {
  const button = document.createElement("button");
  button.className = "slot";
  button.type = "button";
  button.textContent = time;
  return button;
}

function updateSummary() {
  const duration = getSelectedDuration();

  if (!selectedDate) {
    appointmentSummary.textContent = `Choose a weekday for a ${durationLabels[duration]} consultation.`;
    return;
  }

  appointmentSummary.textContent = selectedTime
    ? `${formatDate(selectedDate)} at ${selectedTime} · ${durationLabels[duration]} · ${getModeLabel()}`
    : `${formatDate(selectedDate)} · ${durationLabels[duration]} · choose a time`;
}

function changeMonth(direction) {
  currentMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + direction,
    1,
  );
  renderCalendar();
}

async function loadBookedSlots() {
  try {
    const response = await fetch("/api/booked-slots");

    if (!response.ok) {
      return;
    }

    bookedSlots = await response.json();
    renderCalendar();
    renderSlots();
  } catch {
    formStatus.textContent =
      "Start this project with the included server to enable email confirmations and shared availability.";
  }
}

async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("canceled") === "1") {
    formStatus.textContent = "Payment was canceled. Your appointment has not been confirmed.";
    return;
  }

  if (params.get("paid") !== "1") {
    return;
  }

  const sessionId = params.get("session_id");

  if (!sessionId) {
    formStatus.textContent = "Payment completed, but the booking confirmation could not be loaded.";
    return;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const response = await fetch(`/api/booking-status?session_id=${encodeURIComponent(sessionId)}`);
      const booking = await response.json();

      if (response.ok && booking.status === "confirmed") {
        showReceipt(booking);
        return;
      }
    } catch {
      // Stripe webhooks can arrive a moment after the customer returns from Checkout.
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  formStatus.textContent =
    "Payment was received. Your confirmation email will arrive as soon as Stripe finishes processing.";
}

async function loadAvailability() {
  try {
    const response = await fetch("/api/availability");

    if (!response.ok) {
      return;
    }

    availability = await response.json();
    renderConsultants();
    renderCalendar();
    renderSlots();
    updateSummary();
  } catch {
    availability = defaultAvailability;
    renderConsultants();
  }
}

function getSelectedMode() {
  return new FormData(bookingForm).get("appointmentMode") || "online";
}

function getModeLabel() {
  return getSelectedMode() === "inPerson" ? "In person" : "Online";
}

function getSelectedDuration() {
  return new FormData(bookingForm).get("duration") || "15";
}

function getSelectedConsultant() {
  return new FormData(bookingForm).get("consultant") || getConsultants()[0] || "";
}

function getModeAvailability() {
  const consultant = getConsultantAvailability();
  const modeAvailability = consultant?.[getSelectedMode()];

  if (Array.isArray(modeAvailability)) {
    return {
      weekdays: [1, 2, 3, 4, 5],
      times: modeAvailability,
    };
  }

  return modeAvailability || defaultAvailability[getSelectedMode()];
}

function getModeTimes() {
  return getModeAvailability().times || [];
}

function getModeWeekdays() {
  return getModeAvailability().weekdays || [1, 2, 3, 4, 5];
}

function getConsultants() {
  return (availability.consultants || []).map((consultant) => consultant.name);
}

function getConsultantAvailability() {
  const selectedConsultant = getSelectedConsultant();
  return (availability.consultants || []).find(
    (consultant) => consultant.name === selectedConsultant,
  );
}

function renderConsultants() {
  const select = bookingForm.elements.consultant;
  const selected = select.value;
  const consultants = getConsultants();

  select.innerHTML = '<option value="">Select one</option>';

  consultants.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });

  if (consultants.includes(selected)) {
    select.value = selected;
  } else if (consultants.length) {
    select.value = consultants[0];
  }
}

function updatePaymentButtonState() {
  const formData = new FormData(bookingForm);
  const idDocument = bookingForm.elements.idDocument?.files?.[0];
  const proofOfAddress = bookingForm.elements.proofOfAddress?.files?.[0];
  const hasAppointment = Boolean(selectedDate && selectedTime);
  const hasDocuments = Boolean(idDocument && proofOfAddress);
  const requiredFieldsComplete = [
    "fullName",
    "email",
    "phone",
    "caseType",
    "consultant",
    "message",
  ].every((name) => Boolean(String(formData.get(name) || "").trim()));
  const consentChecked = Boolean(bookingForm.elements.consent?.checked);

  submitButton.disabled = Boolean(
    isSubmitting ||
      !hasAppointment ||
      !hasDocuments ||
      !requiredFieldsComplete ||
      !consentChecked,
  );
}

bookingForm.querySelectorAll('input[name="appointmentMode"], input[name="duration"], select[name="consultant"]').forEach((control) => {
  control.addEventListener("change", () => {
    selectedTime = "";
    formStatus.textContent = "";
    renderSlots();
    updateSummary();
    updatePaymentButtonState();
  });
});

bookingForm.addEventListener("input", updatePaymentButtonState);
bookingForm.addEventListener("change", updatePaymentButtonState);

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formStatus.textContent = "";

  if (!selectedDate || !selectedTime) {
    formStatus.textContent = "Please choose an appointment date and time.";
    return;
  }

  const dateKey = toDateKey(selectedDate);

  if (isBooked(dateKey, selectedTime)) {
    formStatus.textContent = "That time was just booked. Please choose another slot.";
    selectedTime = "";
    renderSlots();
    updateSummary();
    return;
  }

  const formData = new FormData(bookingForm);
  formData.set("date", dateKey);
  formData.set("time", selectedTime);

  isSubmitting = true;
  updatePaymentButtonState();
  submitButton.textContent = "Opening Stripe...";

  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      body: formData,
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not send booking request.");
    }

    bookedSlots.push({
      date: dateKey,
      time: selectedTime,
      appointmentMode: formData.get("appointmentMode"),
      consultant: formData.get("consultant"),
    });

    if (payload.paymentUrl) {
      window.location.assign(payload.paymentUrl);
      return;
    }

    showReceipt(payload.booking);
  } catch (error) {
    formStatus.textContent = error.message;
    isSubmitting = false;
    updatePaymentButtonState();
    submitButton.textContent = "Continue to payment";
  }
});

function showReceipt(booking) {
  const receipt = receiptTemplate.content.cloneNode(true);
  const receiptText = receipt.querySelector("#receiptText");
  const newBookingButton = receipt.querySelector("#newBooking");

  document.body.classList.add("is-receipt-view");
  receiptText.textContent = `${booking.fullName}, your ${booking.caseType.toLowerCase()} consultation request is set for ${formatDate(new Date(`${booking.date}T00:00:00`))} at ${booking.time}. A confirmation email has been sent to ${booking.email}.`;

  bookingPanel.replaceChildren(receipt);

  newBookingButton.addEventListener("click", () => {
    window.location.reload();
  });
}

prevMonthButton.addEventListener("click", () => changeMonth(-1));
nextMonthButton.addEventListener("click", () => changeMonth(1));

renderCalendar();
renderSlots();
updateSummary();
loadBookedSlots();
loadAvailability();
handlePaymentReturn();
updatePaymentButtonState();
