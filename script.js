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

const availableTimes = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"];
const today = startOfDay(new Date());

let currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDate = null;
let selectedTime = "";
let bookedSlots = [];

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
  return bookedSlots.some((booking) => booking.date === dateKey && booking.time === time);
}

function isUnavailableDate(date) {
  const day = date.getDay();
  return date < today || day === 0 || day === 6;
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
    });

    calendarGrid.appendChild(button);
  }
}

function renderSlots() {
  timeSlots.innerHTML = "";

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
  if (!selectedDate) {
    appointmentSummary.textContent = "Choose a weekday from the calendar.";
    return;
  }

  appointmentSummary.textContent = selectedTime
    ? `${formatDate(selectedDate)} at ${selectedTime}`
    : `${formatDate(selectedDate)} - choose a time`;
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
  const booking = {
    date: dateKey,
    time: selectedTime,
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    caseType: formData.get("caseType"),
    message: formData.get("message"),
  };

  submitButton.disabled = true;
  submitButton.textContent = "Sending request...";

  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(booking),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not send booking request.");
    }

    bookedSlots.push({ date: booking.date, time: booking.time });
    showReceipt(payload.booking);
  } catch (error) {
    formStatus.textContent = error.message;
    submitButton.disabled = false;
    submitButton.textContent = "Send booking request";
  }
});

function showReceipt(booking) {
  const receipt = receiptTemplate.content.cloneNode(true);
  const receiptText = receipt.querySelector("#receiptText");
  const newBookingButton = receipt.querySelector("#newBooking");

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
