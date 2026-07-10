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
const calendarCard = document.querySelector(".calendar-card");
const receiptTemplate = document.querySelector("#bookingTemplate");
const languageToggle = document.querySelector("#languageToggle");
const mobileLayout = window.matchMedia("(max-width: 760px)");

const translations = {
  en: {
    languageButton: "Română",
    locale: "en-GB",
    eyebrow: "Legal direction",
    heroTitle: "Book a consultation with Forest & Co",
    heroText:
      "Choose a suitable time and share a short outline of your matter. Our team will review your request with discretion, structure and care.",
    heroPointOneTitle: "London law firm",
    heroPointOneText: "International expertise",
    heroPointTwoTitle: "Individuals & businesses",
    heroPointTwoText: "Tailored legal solutions",
    heroPointThreeTitle: "SRA regulated",
    heroPointThreeText: "Your matter is protected",
    guideOne: "We guide.",
    guideTwo: "We clarify.",
    guideThree: "We protect.",
    guideText:
      "From complex legal matters to everyday decisions, we provide clear advice and strategic support you can rely on.",
    learnMore: "Learn more about us",
    selectedAppointment: "Selected appointment",
    paymentNote: "Choose your consultation type, then complete payment securely through Stripe.",
    hilexQuestion: "Are you a HiLex member?",
    yes: "Yes",
    no: "No",
    noConsultationFee: "No consultation fee",
    consultationFeeApplies: "Consultation fee applies",
    appointmentType: "Appointment type",
    online: "Online",
    inPerson: "In person",
    consultationLength: "Consultation length",
    areaOfLaw: "Area of law",
    feeEarner: "Fee earner",
    selectOne: "Select one",
    selectAreaFirst: "Select an area of law first",
    availableTimes: "Available times",
    fullName: "Full name",
    email: "Email",
    phone: "Phone number",
    caseType: "Case type",
    caseTypePlaceholder: "e.g. divorce, visa, employment dispute",
    briefDescription: "Brief description",
    messagePlaceholder: "Share a short summary of the matter.",
    documents: "Documents",
    documentsNote:
      "Required before continuing: choose the proof of ID type and upload your ID. Proof of address is optional. Accepted formats: PDF, JPG or PNG, up to 10MB each.",
    idType: "Proof of ID type",
    nationalId: "National ID card",
    drivingLicence: "Driving licence",
    passport: "Passport",
    idDocument: "Proof of ID",
    proofOfAddress: "Proof of address (optional)",
    consent: "I agree to be contacted about this appointment request.",
    continueToPayment: "Continue to payment",
    sendRequest: "Send appointment request",
    sendingRequest: "Sending request...",
    openingStripe: "Opening Stripe...",
    bookAnother: "Book another appointment",
    returnToBooking: "Return to booking",
    chooseWeekday: "Choose a weekday",
    minuteConsultation: "minute consultation",
    areaNotSelected: "area not selected",
    chooseTime: "choose a time",
    feeToConfirm: "fee to be confirmed",
    noFeeLower: "no consultation fee",
    at: "at",
    paymentCanceledTitle: "Payment canceled",
    paymentCanceledText:
      "Your appointment has not been confirmed. You can choose a time and try the payment again.",
    paymentReceivedTitle: "Payment received",
    paymentReceivedNoSession:
      "Your payment was received, but the booking confirmation could not be loaded on this screen. The firm will review it shortly.",
    paymentFinalising: "We are finalising your booking confirmation. This usually takes a few seconds.",
    paymentFinalisingSlow: "Your booking is being finalised and the confirmation email will follow shortly.",
    bookingSent: "Booking request sent",
    confirmationEmailSent: "A confirmation email has been sent to",
    paymentCouldNotStart: "Payment could not start",
    chooseAppointment: "Please choose an appointment date and time.",
    timeBooked: "That time was just booked. Please choose another slot.",
    retryAppointment:
      "If you already tried this appointment time, choose another time or wait a few minutes and try again.",
    serverHint:
      "Start this project with the included server to enable email confirmations and shared availability.",
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  ro: {
    languageButton: "English",
    locale: "ro-RO",
    eyebrow: "Consultanță juridică",
    heroTitle: "Programează o consultanță cu Forest & Co",
    heroText:
      "Alege o dată potrivită și trimite-ne câteva detalii despre situația ta. Echipa noastră va analiza cererea cu discreție, structură și atenție.",
    heroPointOneTitle: "Firmă de avocatură în Londra",
    heroPointOneText: "Expertiză internațională",
    heroPointTwoTitle: "Persoane fizice & companii",
    heroPointTwoText: "Soluții juridice adaptate",
    heroPointThreeTitle: "Reglementați SRA",
    heroPointThreeText: "Cazul tău este protejat",
    guideOne: "Ghidăm.",
    guideTwo: "Clarificăm.",
    guideThree: "Protejăm.",
    guideText:
      "De la probleme juridice complexe la decizii de zi cu zi, oferim consultanță clară și sprijin strategic pe care te poți baza.",
    learnMore: "Află mai multe despre noi",
    selectedAppointment: "Programarea selectată",
    paymentNote: "Alege tipul consultanței, apoi finalizează plata în siguranță prin Stripe.",
    hilexQuestion: "Ești membru HiLex?",
    yes: "Da",
    no: "Nu",
    noConsultationFee: "Fără taxă de consultanță",
    consultationFeeApplies: "Se aplică taxa de consultanță",
    appointmentType: "Tipul programării",
    online: "Online",
    inPerson: "În persoană",
    consultationLength: "Durata consultanței",
    areaOfLaw: "Domeniul juridic",
    feeEarner: "Avocat / consultant",
    selectOne: "Selectează",
    selectAreaFirst: "Selectează mai întâi domeniul juridic",
    availableTimes: "Ore disponibile",
    fullName: "Nume complet",
    email: "Email",
    phone: "Număr de telefon",
    caseType: "Tipul cazului",
    caseTypePlaceholder: "ex. divorț, viză, litigiu de muncă",
    briefDescription: "Scurtă descriere",
    messagePlaceholder: "Scrie un scurt rezumat al situației.",
    documents: "Documente",
    documentsNote:
      "Obligatoriu înainte de continuare: alege tipul actului de identitate și încarcă documentul. Dovada adresei este opțională. Formate acceptate: PDF, JPG sau PNG, maximum 10MB fiecare.",
    idType: "Tip act de identitate",
    nationalId: "Carte de identitate",
    drivingLicence: "Permis de conducere",
    passport: "Pașaport",
    idDocument: "Act de identitate",
    proofOfAddress: "Dovada adresei (opțional)",
    consent: "Sunt de acord să fiu contactat/ă în legătură cu această cerere de programare.",
    continueToPayment: "Continuă către plată",
    sendRequest: "Trimite cererea de programare",
    sendingRequest: "Se trimite cererea...",
    openingStripe: "Se deschide Stripe...",
    bookAnother: "Fă o altă programare",
    returnToBooking: "Înapoi la programare",
    chooseWeekday: "Alege o zi disponibilă",
    minuteConsultation: "consultanță de minute",
    areaNotSelected: "domeniu neselectat",
    chooseTime: "alege o oră",
    feeToConfirm: "taxă de confirmat",
    noFeeLower: "fără taxă de consultanță",
    at: "la",
    paymentCanceledTitle: "Plată anulată",
    paymentCanceledText:
      "Programarea nu a fost confirmată. Poți alege o oră și poți încerca plata din nou.",
    paymentReceivedTitle: "Plată primită",
    paymentReceivedNoSession:
      "Plata a fost primită, dar confirmarea programării nu a putut fi încărcată pe acest ecran. Firma va verifica cererea în scurt timp.",
    paymentFinalising: "Finalizăm confirmarea programării. De obicei durează câteva secunde.",
    paymentFinalisingSlow: "Programarea este în curs de finalizare, iar emailul de confirmare va urma în scurt timp.",
    bookingSent: "Cererea de programare a fost trimisă",
    confirmationEmailSent: "Un email de confirmare a fost trimis către",
    paymentCouldNotStart: "Plata nu a putut fi pornită",
    chooseAppointment: "Te rugăm să alegi data și ora programării.",
    timeBooked: "Această oră tocmai a fost rezervată. Te rugăm să alegi alt interval.",
    retryAppointment:
      "Dacă ai încercat deja acest interval, alege altă oră sau așteaptă câteva minute și încearcă din nou.",
    serverHint:
      "Pornește proiectul cu serverul inclus pentru emailuri de confirmare și disponibilitate comună.",
    weekdays: ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"],
  },
};

function getSavedLanguage() {
  try {
    return localStorage.getItem("bookingLanguage") === "ro" ? "ro" : "en";
  } catch {
    return "en";
  }
}

let currentLanguage = getSavedLanguage();

function t(key) {
  return translations[currentLanguage][key] || translations.en[key] || key;
}

const defaultAvailability = {
  consultants: [
    {
      name: "Mihaela Pădure",
      areas: ["Family law", "Immigration"],
      fees: { 15: 140, 30: 280 },
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
  return new Intl.DateTimeFormat(t("locale"), {
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

  const monthName = new Intl.DateTimeFormat(t("locale"), {
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
  const feeLabel = getSelectedHilexMember() === "yes" ? t("noFeeLower") : getFeeLabel(duration);
  const area = getSelectedArea();

  if (!selectedDate) {
    appointmentSummary.textContent =
      currentLanguage === "ro"
        ? `${t("chooseWeekday")} pentru o consultanță de ${duration} minute (${feeLabel}).`
        : `${t("chooseWeekday")} for a ${duration} ${t("minuteConsultation")} (${feeLabel}).`;
    return;
  }

  appointmentSummary.textContent = selectedTime
    ? `${formatDate(selectedDate)} ${t("at")} ${selectedTime} · ${area || t("areaNotSelected")} · ${duration} min · ${feeLabel} · ${getModeLabel()}`
    : `${formatDate(selectedDate)} · ${area || t("areaNotSelected")} · ${duration} min · ${feeLabel} · ${t("chooseTime")}`;
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
      t("serverHint");
  }
}

async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("canceled") === "1") {
    showNoticeReceipt(
      t("paymentCanceledTitle"),
      t("paymentCanceledText"),
    );
    return;
  }

  if (params.get("paid") !== "1") {
    return;
  }

  const sessionId = params.get("session_id");

  if (!sessionId) {
    showNoticeReceipt(
      t("paymentReceivedTitle"),
      t("paymentReceivedNoSession"),
    );
    return;
  }

  showNoticeReceipt(
    t("paymentReceivedTitle"),
    t("paymentFinalising"),
  );

  for (let attempt = 0; attempt < 30; attempt += 1) {
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

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  showNoticeReceipt(
    t("paymentReceivedTitle"),
    t("paymentFinalisingSlow"),
  );
}

async function loadAvailability() {
  try {
    const response = await fetch("/api/availability");

    if (!response.ok) {
      return;
    }

    availability = await response.json();
    renderAreas();
    renderConsultants();
    renderCalendar();
    renderSlots();
    updateSummary();
  } catch {
    availability = defaultAvailability;
    renderAreas();
    renderConsultants();
  }
}

function getSelectedMode() {
  return new FormData(bookingForm).get("appointmentMode") || "online";
}

function getSelectedHilexMember() {
  return new FormData(bookingForm).get("hilexMember") || "no";
}

function getModeLabel() {
  return getSelectedMode() === "inPerson" ? t("inPerson") : t("online");
}

function getSelectedDuration() {
  return new FormData(bookingForm).get("duration") || "15";
}

function getSelectedConsultant() {
  return new FormData(bookingForm).get("consultant") || getConsultants()[0] || "";
}

function getSelectedArea() {
  return new FormData(bookingForm).get("areaOfLaw") || "";
}

function normaliseChoice(value) {
  return String(value || "").trim().toLowerCase();
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

  return modeAvailability || { weekdays: [], times: [] };
}

function getModeTimes() {
  return getModeAvailability().times || [];
}

function getModeWeekdays() {
  return getModeAvailability().weekdays || [1, 2, 3, 4, 5];
}

function getConsultants() {
  const area = getSelectedArea();
  const consultants = availability.consultants || [];

  if (!area) {
    return [];
  }

  return consultants
    .filter((consultant) =>
      (consultant.areas || []).some(
        (consultantArea) => normaliseChoice(consultantArea) === normaliseChoice(area),
      ),
    )
    .map((consultant) => consultant.name);
}

function getConsultantAvailability() {
  const selectedConsultant = getSelectedConsultant();
  return (availability.consultants || []).find(
    (consultant) => consultant.name === selectedConsultant,
  );
}

function getAreas() {
  return [
    ...new Set(
      (availability.consultants || [])
        .flatMap((consultant) => consultant.areas || [])
        .map((area) => String(area).trim())
        .filter(Boolean),
    ),
  ].sort();
}

function getFeeLabel(duration) {
  const consultant = getConsultantAvailability();
  const fee = Number(consultant?.fees?.[duration]);

  if (!Number.isFinite(fee) || fee <= 0) {
    return t("feeToConfirm");
  }

  return `£${fee} + VAT`;
}

function renderAreas() {
  const select = bookingForm.elements.areaOfLaw;
  const selected = select.value;
  const areas = getAreas();

  select.innerHTML = `<option value="">${t("selectOne")}</option>`;

  areas.forEach((area) => {
    const option = document.createElement("option");
    option.value = area;
    option.textContent = area;
    select.appendChild(option);
  });

  if (areas.includes(selected)) {
    select.value = selected;
  }
}

function renderConsultants() {
  const select = bookingForm.elements.consultant;
  const selected = select.value;
  const consultants = getConsultants();

  select.innerHTML = getSelectedArea()
    ? `<option value="">${t("selectOne")}</option>`
    : `<option value="">${t("selectAreaFirst")}</option>`;

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

  updateDurationLabels();
}

function updateDurationLabels() {
  bookingForm.querySelectorAll('input[name="duration"]').forEach((input) => {
    const label = input.closest(".choice-card");
    const small = label?.querySelector("small");

    if (small) {
      small.textContent =
        getSelectedHilexMember() === "yes" ? t("noConsultationFee") : getFeeLabel(input.value);
    }
  });
}

function updatePaymentButtonState() {
  const formData = new FormData(bookingForm);
  const idDocument = bookingForm.elements.idDocument?.files?.[0];
  const hasAppointment = Boolean(selectedDate && selectedTime);
  const hasDocuments = Boolean(idDocument);
  const requiredFieldsComplete = [
    "areaOfLaw",
    "fullName",
    "email",
    "phone",
    "caseType",
    "consultant",
    "idType",
    "hilexMember",
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

  submitButton.textContent =
    getSelectedHilexMember() === "yes" ? t("sendRequest") : t("continueToPayment");
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  languageToggle.textContent = t("languageButton");

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });

  document.querySelectorAll(".weekday-row span").forEach((element, index) => {
    element.textContent = t("weekdays")[index] || element.textContent;
  });

  renderAreas();
  renderConsultants();
  renderCalendar();
  renderSlots();
  updateSummary();
  updatePaymentButtonState();
}

function placeCalendarForViewport() {
  const timeSection = timeSlots.closest("fieldset");

  if (!calendarCard || !timeSection) {
    return;
  }

  if (mobileLayout.matches) {
    bookingForm.insertBefore(calendarCard, timeSection);
    return;
  }

  bookingPanel.insertBefore(calendarCard, bookingForm);
}

bookingForm.querySelectorAll('input[name="appointmentMode"], input[name="duration"], input[name="hilexMember"], select[name="consultant"], select[name="areaOfLaw"]').forEach((control) => {
  control.addEventListener("change", () => {
    selectedTime = "";
    formStatus.textContent = "";

    if (control.name === "areaOfLaw") {
      renderConsultants();
    }

    if (control.name === "consultant" || control.name === "hilexMember") {
      updateDurationLabels();
    }

    if (selectedDate && isUnavailableDate(selectedDate)) {
      selectedDate = null;
    }

    renderCalendar();
    renderSlots();
    updateSummary();
    updatePaymentButtonState();
  });
});

mobileLayout.addEventListener("change", placeCalendarForViewport);
languageToggle.addEventListener("click", () => {
  currentLanguage = currentLanguage === "en" ? "ro" : "en";
  try {
    localStorage.setItem("bookingLanguage", currentLanguage);
  } catch {
    // The language still changes for the current visit if storage is unavailable.
  }
  applyLanguage();
});
bookingForm.addEventListener("input", updatePaymentButtonState);
bookingForm.addEventListener("change", updatePaymentButtonState);

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formStatus.textContent = "";

  if (!selectedDate || !selectedTime) {
    formStatus.textContent = t("chooseAppointment");
    return;
  }

  const dateKey = toDateKey(selectedDate);

  if (isBooked(dateKey, selectedTime)) {
    formStatus.textContent = t("timeBooked");
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
  submitButton.textContent =
    formData.get("hilexMember") === "yes" ? t("sendingRequest") : t("openingStripe");

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
    showNoticeReceipt(
      t("paymentCouldNotStart"),
      `${error.message} ${t("retryAppointment")}`,
    );
    isSubmitting = false;
    updatePaymentButtonState();
  }
});

function showReceipt(booking, options = {}) {
  const receipt = receiptTemplate.content.cloneNode(true);
  const receiptTitle = receipt.querySelector("#receiptTitle");
  const receiptText = receipt.querySelector("#receiptText");
  const newBookingButton = receipt.querySelector("#newBooking");

  document.body.classList.add("is-receipt-view");
  receiptTitle.textContent = options.title || t("bookingSent");
  receiptText.textContent =
    options.message ||
    (currentLanguage === "ro"
      ? `${booking.fullName}, consultanța ta pentru ${(booking.areaOfLaw || booking.caseType).toLowerCase()} este programată pentru ${formatDate(new Date(`${booking.date}T00:00:00`))} ${t("at")} ${booking.time}. ${t("confirmationEmailSent")} ${booking.email}.`
      : `${booking.fullName}, your ${(booking.areaOfLaw || booking.caseType).toLowerCase()} consultation request is set for ${formatDate(new Date(`${booking.date}T00:00:00`))} at ${booking.time}. ${t("confirmationEmailSent")} ${booking.email}.`);
  newBookingButton.textContent = options.buttonText || t("bookAnother");

  bookingPanel.replaceChildren(receipt);

  newBookingButton.addEventListener("click", () => {
    window.location.reload();
  });
}

function showNoticeReceipt(title, message) {
  showReceipt(
    {
      fullName: "",
      caseType: "",
      date: toDateKey(today),
      time: "",
      email: "",
    },
    { title, message, buttonText: t("returnToBooking") },
  );
}

prevMonthButton.addEventListener("click", () => changeMonth(-1));
nextMonthButton.addEventListener("click", () => changeMonth(1));

placeCalendarForViewport();
applyLanguage();
renderAreas();
renderConsultants();
renderCalendar();
renderSlots();
updateSummary();
loadBookedSlots();
loadAvailability();
handlePaymentReturn();
updatePaymentButtonState();
