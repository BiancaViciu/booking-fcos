require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const Stripe = require("stripe");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "");
const publicDir = __dirname;
const dataDir = path.join(__dirname, "data");
const uploadDir = path.join(dataDir, "uploads");
const bookingsPath = path.join(dataDir, "bookings.json");
const availabilityPath = path.join(__dirname, "availability.json");

const port = Number(process.env.PORT || 4242);
const firmEmail = process.env.FIRM_EMAIL || "";
const paymentHoldMinutes = Number(process.env.PAYMENT_HOLD_MINUTES || 30);
const siteUrl = process.env.SITE_URL || `http://localhost:${port}`;
const currency = process.env.STRIPE_CURRENCY || "gbp";
const vatRate = Number(process.env.VAT_RATE || 20);
const stripeVatTaxRateId = process.env.STRIPE_VAT_TAX_RATE_ID || "";
const hilexMembershipVerifyUrl =
  process.env.HILEX_MEMBERSHIP_VERIFY_URL || "https://membersaccess.hilex.co.uk/api/membership/verify";
const defaultServices = [
  "Business Law",
  "Civil Law",
  "Corporate/Commercial Law",
  "Criminal Law",
  "Dispute Resolution",
  "Employment Law",
  "Family Law",
  "Immigration",
  "Real Estate",
  "Other",
];

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (request, file, callback) => {
      callback(null, uploadDir);
    },
    filename: (request, file, callback) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
      callback(null, `${Date.now()}-${crypto.randomUUID()}-${safeName}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 2,
  },
  fileFilter: (request, file, callback) => {
    const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      callback(new Error("Documents must be PDF, JPG or PNG files."));
      return;
    }

    callback(null, true);
  },
});

app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    const signature = request.headers["stripe-signature"];
    let event;

    try {
      event = process.env.STRIPE_WEBHOOK_SECRET
        ? stripe.webhooks.constructEvent(
            request.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET,
          )
        : JSON.parse(request.body.toString());
    } catch (error) {
      return response.status(400).send(`Webhook Error: ${error.message}`);
    }

    if (event.type === "checkout.session.completed") {
      try {
        await confirmPaidBooking(event.data.object);
      } catch (error) {
        console.error("Could not confirm paid booking:", error);
        return response.status(500).json({ error: "Could not confirm paid booking." });
      }
    }

    response.json({ received: true });
  },
);

app.use(express.json());
app.use(express.static(publicDir));

app.get("/api/booked-slots", (request, response) => {
  const bookedSlots = readBookings()
    .filter(isActiveBooking)
    .map((booking) => ({
      date: booking.date,
      time: booking.time,
      appointmentMode: booking.appointmentMode,
      consultant: booking.consultant,
    }));

  response.json(bookedSlots);
});

app.get("/api/availability", (request, response) => {
  response.json(readAvailability());
});

app.post("/api/hilex-membership/verify", async (request, response) => {
  const email = normalizeEmail(request.body?.email);

  if (!isValidEmail(email)) {
    return response.status(400).json({ error: "Please enter a valid HiLex account email." });
  }

  try {
    const membership = await verifyHilexMembership(email);
    response.json(getPublicHilexMembershipResponse(membership));
  } catch (error) {
    console.error("HiLex membership verification failed:", error);
    response.status(502).json({ error: "Could not verify HiLex membership right now." });
  }
});

app.get("/api/admin/availability", (request, response) => {
  if (!isValidAdminRequest(request)) {
    return response.status(401).json({ error: getAdminPinError() });
  }

  response.json(readAvailability());
});

app.get("/api/admin/bookings", async (request, response) => {
  if (!isValidAdminRequest(request)) {
    return response.status(401).json({ error: getAdminPinError() });
  }

  await syncPaidBookings();

  const bookings = readBookings()
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(formatAdminBooking);

  response.json({ bookings });
});

app.post("/api/admin/sync-payments", async (request, response) => {
  if (!isValidAdminRequest(request)) {
    return response.status(401).json({ error: getAdminPinError() });
  }

  try {
    const result = await syncPaidBookings();
    response.json(result);
  } catch (error) {
    console.error("Could not sync Stripe payments:", error);
    response.status(500).json({ error: `Could not sync Stripe payments: ${error.message}` });
  }
});

app.post("/api/admin/test-email", async (request, response) => {
  if (!isValidAdminRequest(request)) {
    return response.status(401).json({ error: getAdminPinError() });
  }

  try {
    await sendTestEmail();
    response.json({ message: `Test email sent to ${firmEmail}.` });
  } catch (error) {
    console.error("Test email failed:", error);
    response.status(500).json({ error: `Email test failed: ${error.message}` });
  }
});

app.post("/api/admin/bookings/:bookingId/resend-email", async (request, response) => {
  if (!isValidAdminRequest(request)) {
    return response.status(401).json({ error: getAdminPinError() });
  }

  const bookings = readBookings();
  const booking = bookings.find((item) => item.id === request.params.bookingId);

  if (!booking) {
    return response.status(404).json({ error: "Booking was not found." });
  }

  if (booking.status !== "confirmed") {
    return response.status(400).json({ error: "Only confirmed paid bookings can be emailed." });
  }

  try {
    await sendBookingEmails(booking);
    booking.emailStatus = "sent";
    booking.emailError = "";
    writeBookings(bookings);
    response.json({ booking: formatAdminBooking(booking) });
  } catch (error) {
    booking.emailStatus = "failed";
    booking.emailError = error.message;
    writeBookings(bookings);
    console.error("Manual booking email resend failed:", error);
    response.status(500).json({ error: `Email resend failed: ${error.message}` });
  }
});

app.get("/api/admin/bookings/:bookingId/documents/:documentIndex", (request, response) => {
  if (!isValidAdminRequest(request)) {
    return response.status(401).json({ error: getAdminPinError() });
  }

  const booking = readBookings().find((item) => item.id === request.params.bookingId);
  const documentIndex = Number(request.params.documentIndex);
  const document = booking?.documents?.[documentIndex];

  if (!booking || !document || !document.path || !fs.existsSync(document.path)) {
    return response.status(404).json({ error: "Document was not found." });
  }

  response.download(document.path, `${document.label} - ${document.originalName}`);
});

app.post("/api/admin/availability", (request, response) => {
  if (!isValidAdminRequest(request)) {
    return response.status(401).json({ error: getAdminPinError() });
  }

  const availability = normalizeAvailability(request.body.availability || request.body);

  if (!availability) {
    return response.status(400).json({ error: "Availability data is not valid." });
  }

  writeAvailability(availability);
  response.json({ availability });
});

app.get("/api/booking-status", async (request, response) => {
  const sessionId = String(request.query.session_id || "");
  const booking = readBookings().find((item) => item.checkoutSessionId === sessionId);

  if (!booking) {
    return response.status(404).json({ error: "Booking was not found." });
  }

  if (booking.status === "awaiting_payment") {
    await syncPaidBooking(booking);
  }

  const refreshedBooking = readBookings().find((item) => item.checkoutSessionId === sessionId);

  response.json({
    status: refreshedBooking.status,
    date: refreshedBooking.date,
    time: refreshedBooking.time,
    fullName: refreshedBooking.fullName,
    email: refreshedBooking.email,
    caseType: refreshedBooking.caseType,
    areaOfLaw: refreshedBooking.areaOfLaw || refreshedBooking.caseType,
    appointmentMode: refreshedBooking.appointmentMode,
    duration: refreshedBooking.duration,
    consultant: refreshedBooking.consultant,
    hilexMember: refreshedBooking.hilexMember,
  });
});

app.post(
  "/api/bookings",
  upload.fields([
    { name: "idDocument", maxCount: 1 },
    { name: "proofOfAddress", maxCount: 1 },
  ]),
  async (request, response) => {
  const booking = normalizeBooking(request.body);

  if (!booking) {
    cleanupUploadedFiles(request);
    return response.status(400).json({ error: "Please complete all required booking fields." });
  }

  const bookings = readBookings();
  const slotTaken = bookings.some(
    (item) =>
      (item.status === "confirmed" || item.status === "awaiting_payment") &&
      isActiveBooking(item) &&
      item.date === booking.date &&
      item.time === booking.time &&
      item.appointmentMode === booking.appointmentMode &&
      item.consultant === booking.consultant,
  );

  if (slotTaken) {
    cleanupUploadedFiles(request);
    return response.status(409).json({ error: "That appointment time is no longer available." });
  }

  const bookingId = crypto.randomUUID();
  const isHilexMember = booking.hilexMember === "yes";
  let hilexMembership = null;

  if (isHilexMember) {
    try {
      hilexMembership = await verifyHilexMembership(booking.hilexEmail);
    } catch (error) {
      cleanupUploadedFiles(request);
      console.error("HiLex membership verification failed during booking:", error);
      return response.status(502).json({
        error: "Could not verify HiLex membership right now. Please try again or continue with payment.",
      });
    }

    if (!hilexMembership.member) {
      cleanupUploadedFiles(request);
      return response.status(403).json({
        error:
          "We could not find an active HiLex membership for this email. Please use the email used to purchase your membership or contact us.",
      });
    }
  }

  const confirmedBooking = {
    id: bookingId,
    status: isHilexMember ? "confirmed" : "awaiting_payment",
    createdAt: new Date().toISOString(),
    paymentStatus: isHilexMember ? "not_required_hilex_member" : "",
    hilexMembership,
    documents: collectUploadedDocuments(request, booking),
    ...booking,
  };

  if (isHilexMember) {
    bookings.push(confirmedBooking);
    writeBookings(bookings);

    try {
      await sendBookingEmails(confirmedBooking);
      confirmedBooking.emailStatus = "sent";
    } catch (error) {
      confirmedBooking.emailStatus = "failed";
      confirmedBooking.emailError = error.message;
      console.error("HiLex booking confirmed, but email failed:", error);
    }

    writeBookings(bookings);
    response.status(201).json({
      booking: getPublicBookingResponse(confirmedBooking),
    });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    cleanupUploadedFiles(request);
    return response.status(500).json({ error: "Stripe is not configured yet." });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: booking.email,
      client_reference_id: bookingId,
      success_url: `${siteUrl}/?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?canceled=1`,
      line_items: [buildStripeLineItem(booking)],
      metadata: {
        bookingId,
        duration: booking.duration,
        appointmentMode: booking.appointmentMode,
        consultant: booking.consultant,
        areaOfLaw: booking.areaOfLaw,
        hilexMember: booking.hilexMember,
      },
    });

    confirmedBooking.checkoutSessionId = session.id;
    bookings.push(confirmedBooking);
    writeBookings(bookings);

    response.status(201).json({
      paymentUrl: session.url,
      booking: getPublicBookingResponse(confirmedBooking),
    });
  } catch (error) {
    cleanupUploadedFiles(request);
    console.error("Stripe Checkout error:", error);
    response.status(500).json({ error: "Could not start Stripe payment." });
  }
});

app.listen(port, () => {
  console.log(`Booking system running at http://localhost:${port}`);
});

function normalizeBooking(input) {
  const availability = readAvailability();
  const booking = {
    date: String(input.date || "").trim(),
    time: String(input.time || "").trim(),
    fullName: String(input.fullName || "").trim(),
    email: String(input.email || "").trim(),
    phone: String(input.phone || "").trim(),
    areaOfLaw: String(input.areaOfLaw || input.caseType || "").trim(),
    caseType: String(input.caseType || "").trim(),
    appointmentMode: String(input.appointmentMode || "").trim(),
    duration: String(input.duration || "").trim(),
    consultant: String(input.consultant || "").trim(),
    hilexMember: String(input.hilexMember || "").trim(),
    hilexEmail: normalizeEmail(input.hilexEmail),
    idType: String(input.idType || "").trim(),
    message: String(input.message || "").trim(),
  };

  if (!booking.consultant) {
    booking.consultant = getAvailableConsultantForBooking(availability, booking)?.name || "";
  }

  const consultant = getConsultantByName(availability, booking.consultant);
  const hasRequiredFields = [
    booking.date,
    booking.time,
    booking.fullName,
    booking.email,
    booking.phone,
    booking.areaOfLaw,
    booking.caseType,
    booking.appointmentMode,
    booking.duration,
    booking.consultant,
    booking.hilexMember,
    booking.hilexMember === "yes" ? booking.hilexEmail : true,
  ].every(Boolean);
  const hasValidEmail = isValidEmail(booking.email);
  const hasValidHilexEmail = booking.hilexMember !== "yes" || isValidEmail(booking.hilexEmail);
  const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(booking.date);
  const hasValidTime = /^\d{2}:\d{2}$/.test(booking.time);
  const hasValidMode = ["online", "inPerson"].includes(booking.appointmentMode);
  const hasValidDuration = ["15", "30"].includes(booking.duration);
  const hasValidConsultant = Boolean(consultant);
  const hasValidArea = Boolean(
    consultant?.areas?.some((area) => normalizeComparable(area) === normalizeComparable(booking.areaOfLaw)),
  );
  const hasValidHilexAnswer = ["yes", "no"].includes(booking.hilexMember);
  const hasValidIdType =
    !booking.idType || ["National ID card", "Driving licence", "Passport"].includes(booking.idType);
  const hasValidFee =
    booking.hilexMember === "yes" || getConsultationFeePence(consultant, booking.duration) > 0;

  if (
    !hasRequiredFields ||
    !hasValidEmail ||
    !hasValidHilexEmail ||
    !hasValidDate ||
    !hasValidTime ||
    !hasValidMode ||
    !hasValidDuration ||
    !hasValidConsultant ||
    !hasValidArea ||
    !hasValidHilexAnswer ||
    !hasValidIdType ||
    !hasValidFee
  ) {
    return null;
  }

  return booking;
}

function readBookings() {
  try {
    return JSON.parse(fs.readFileSync(bookingsPath, "utf8"));
  } catch {
    return [];
  }
}

function writeBookings(bookings) {
  fs.writeFileSync(bookingsPath, JSON.stringify(bookings, null, 2));
}

function formatAdminBooking(booking) {
  return {
    id: booking.id,
    status: booking.status,
    createdAt: booking.createdAt,
    paidAt: booking.paidAt || "",
    paymentStatus: booking.paymentStatus || "",
    date: booking.date,
    time: booking.time,
    fullName: booking.fullName,
    email: booking.email,
    phone: booking.phone,
    caseType: booking.caseType,
    areaOfLaw: booking.areaOfLaw || booking.caseType,
    hilexMember: booking.hilexMember || "",
    hilexEmail: booking.hilexEmail || "",
    hilexMembership: booking.hilexMembership || null,
    idType: booking.idType || "",
    appointmentMode: booking.appointmentMode,
    duration: booking.duration,
    consultant: booking.consultant,
    message: booking.message,
    emailStatus: booking.emailStatus || "",
    documents: (booking.documents || []).map((document, index) => ({
      index,
      label: document.label,
      originalName: document.originalName,
      size: document.size,
      available: Boolean(document.path && fs.existsSync(document.path)),
    })),
  };
}

function getPublicBookingResponse(booking) {
  return {
    status: booking.status,
    date: booking.date,
    time: booking.time,
    fullName: booking.fullName,
    email: booking.email,
    caseType: booking.caseType,
    areaOfLaw: booking.areaOfLaw || booking.caseType,
    appointmentMode: booking.appointmentMode,
    duration: booking.duration,
    consultant: booking.consultant,
    hilexMember: booking.hilexMember,
    hilexEmail: booking.hilexEmail || "",
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

async function verifyHilexMembership(email) {
  const response = await fetch(hilexMembershipVerifyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || `HiLex returned HTTP ${response.status}`);
  }

  return {
    member: data.member === true && (!data.status || data.status === "active"),
    plan: data.plan || "",
    status: data.status || "",
    validUntil: data.validUntil || "",
  };
}

function getPublicHilexMembershipResponse(membership) {
  return {
    member: membership.member,
    plan: membership.plan,
    status: membership.status,
    validUntil: membership.validUntil,
  };
}

function collectUploadedDocuments(request, booking = {}) {
  const files = request.files || {};
  const documents = [];

  if (files.idDocument?.[0]) {
    documents.push(formatUploadedDocument(`Proof of ID - ${booking.idType || "ID"}`, files.idDocument[0]));
  }

  if (files.proofOfAddress?.[0]) {
    documents.push(formatUploadedDocument("Proof of address", files.proofOfAddress[0]));
  }

  return documents;
}

function cleanupUploadedFiles(request) {
  Object.values(request.files || {})
    .flat()
    .forEach((file) => {
      try {
        fs.unlinkSync(file.path);
      } catch {
        // Nothing else to do if a temporary upload is already gone.
      }
    });
}

function cleanupBookingDocuments(booking) {
  (booking.documents || []).forEach((document) => {
    try {
      fs.unlinkSync(document.path);
    } catch {
      // Keep the booking flow resilient if the file has already been removed.
    }
  });
}

function formatUploadedDocument(label, file) {
  return {
    label,
    originalName: file.originalname,
    path: file.path,
    mimeType: file.mimetype,
    size: file.size,
  };
}

function readAvailability() {
  try {
    return normalizeAvailability(JSON.parse(fs.readFileSync(availabilityPath, "utf8"))) || getDefaultAvailability();
  } catch {
    return getDefaultAvailability();
  }
}

function writeAvailability(availability) {
  fs.writeFileSync(availabilityPath, JSON.stringify(availability, null, 2));
}

function getDefaultAvailability() {
  return {
    services: defaultServices,
    consultants: [
      {
        name: "Mihaela Pădure",
        areas: ["Family Law", "Immigration"],
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
      {
        name: "Sandra Zăuleț",
        areas: ["Business Law", "Employment Law", "Real Estate"],
        fees: { 15: 140, 30: 280 },
        online: {
          weekdays: [1, 3, 5],
          times: ["09:30", "10:30", "12:00", "14:30"],
        },
        inPerson: {
          weekdays: [1, 4],
          times: ["11:00", "15:00"],
        },
      },
      {
        name: "Eleonora Sorodoc",
        areas: ["Immigration", "Criminal Law", "Other"],
        fees: { 15: 140, 30: 280 },
        online: {
          weekdays: [2, 4],
          times: ["10:00", "12:00", "14:00", "16:00"],
        },
        inPerson: {
          weekdays: [3],
          times: ["10:00", "13:00"],
        },
      },
    ],
  };
}

function normalizeAvailability(input) {
  if (input?.consultants && Array.isArray(input.consultants)) {
    const services = normalizeServices(
      input.services,
      input.consultants.flatMap((consultant) => consultant.areas || []),
    );
    const consultants = input.consultants
      .map((consultant) => ({
        name: String(consultant.name || "").trim(),
        areas: normalizeAreas(consultant.areas, services),
        fees: normalizeFees(consultant.fees),
        online: normalizeModeAvailability(consultant.online),
        inPerson: normalizeModeAvailability(consultant.inPerson),
      }))
      .filter((consultant) => consultant.name);

    return consultants.length ? { services, consultants } : null;
  }

  if (input?.online || input?.inPerson) {
    return {
      services: getDefaultAvailability().services,
      consultants: getDefaultAvailability().consultants.map((consultant) => ({
        name: consultant.name,
        areas: consultant.areas,
        fees: consultant.fees,
        online: normalizeModeAvailability(input.online),
        inPerson: normalizeModeAvailability(input.inPerson),
      })),
    };
  }

  return null;
}

function normalizeServices(services, fallbackAreas = []) {
  const values = Array.isArray(services) && services.length ? services : fallbackAreas;
  const normalizedServices = values.map((service) => String(service).trim()).filter(Boolean);
  const fallbackServices = defaultServices;

  return uniqueLabels(normalizedServices.length ? normalizedServices : fallbackServices);
}

function normalizeAreas(areas, services = defaultServices) {
  const normalizedAreas = Array.isArray(areas)
    ? areas.map((area) => String(area).trim()).filter(Boolean)
    : [services[0] || "Family Law"];

  const serviceMap = new Map(services.map((service) => [normalizeComparable(service), service]));
  const matchedAreas = normalizedAreas
    .map((area) => serviceMap.get(normalizeComparable(area)) || area)
    .filter((area) => serviceMap.has(normalizeComparable(area)));

  return uniqueLabels(matchedAreas.length ? matchedAreas : [services[0] || "Family Law"]);
}

function uniqueLabels(values) {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const label = String(value).trim();
    const key = normalizeComparable(label);

    if (!label || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(label);
  });

  return result;
}

function normalizeComparable(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeFees(fees = {}) {
  return {
    15: normalizeFee(fees[15] ?? fees["15"], 140),
    30: normalizeFee(fees[30] ?? fees["30"], 280),
  };
}

function normalizeFee(value, fallback) {
  const fee = Number(value);

  return Number.isFinite(fee) && fee >= 0 ? fee : fallback;
}

function normalizeModeAvailability(modeAvailability = {}) {
  const weekdays = Array.isArray(modeAvailability.weekdays)
    ? modeAvailability.weekdays
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [1, 2, 3, 4, 5];

  const times = Array.isArray(modeAvailability.times)
    ? modeAvailability.times
        .map((time) => String(time).trim())
        .filter((time) => /^\d{2}:\d{2}$/.test(time))
    : [];

  return {
    weekdays: [...new Set(weekdays)].sort((a, b) => a - b),
    times: [...new Set(times)].sort(),
  };
}

function getConsultants(availability) {
  return (availability.consultants || []).map((consultant) => consultant.name);
}

function getConsultantByName(availability, name) {
  return (availability.consultants || []).find((consultant) => consultant.name === name);
}

function getAvailableConsultantForBooking(availability, booking) {
  const weekday = new Date(`${booking.date}T00:00:00`).getDay();
  const bookings = readBookings();

  return (availability.consultants || []).find((consultant) => {
    const coversArea = (consultant.areas || []).some(
      (area) => normalizeComparable(area) === normalizeComparable(booking.areaOfLaw),
    );
    const modeAvailability = consultant[booking.appointmentMode] || {};
    const worksThatDay = (modeAvailability.weekdays || []).includes(weekday);
    const hasThatTime = (modeAvailability.times || []).includes(booking.time);
    const alreadyBooked = bookings.some(
      (item) =>
        isActiveBooking(item) &&
        item.date === booking.date &&
        item.time === booking.time &&
        item.appointmentMode === booking.appointmentMode &&
        item.consultant === consultant.name,
    );

    return coversArea && worksThatDay && hasThatTime && !alreadyBooked;
  });
}

function getConsultationFeePence(consultant, duration) {
  const fee = Number(consultant?.fees?.[duration]);

  return Number.isFinite(fee) && fee > 0 ? Math.round(fee * 100) : 0;
}

function isValidAdminRequest(request) {
  const configuredPin = String(process.env.ADMIN_PIN || "").trim();
  const requestPin = String(
    request.get("x-admin-pin") || request.query?.pin || request.body?.pin || "",
  ).trim();

  return Boolean(configuredPin) && requestPin === configuredPin;
}

function getAdminPinError() {
  return process.env.ADMIN_PIN
    ? "Invalid admin PIN."
    : "Admin PIN is not configured in Render. Add ADMIN_PIN in Environment Variables.";
}

function isActiveBooking(booking) {
  if (booking.status === "confirmed") {
    return true;
  }

  if (booking.status !== "awaiting_payment") {
    return false;
  }

  const createdAt = new Date(booking.createdAt).getTime();
  const expiresAt = createdAt + paymentHoldMinutes * 60 * 1000;

  return Number.isFinite(createdAt) && expiresAt > Date.now();
}

function buildStripeLineItem(booking) {
  const consultant = getConsultantByName(readAvailability(), booking.consultant);
  const baseAmount = getConsultationFeePence(consultant, booking.duration);
  const amount = stripeVatTaxRateId ? baseAmount : Math.round(baseAmount * (1 + vatRate / 100));
  const lineItem = {
    quantity: 1,
    price_data: {
      currency,
      unit_amount: amount,
      product_data: {
        name: `${booking.duration} minute legal consultation`,
        description: `${booking.appointmentMode === "inPerson" ? "In person" : "Online"} ${booking.areaOfLaw || booking.caseType} consultation with ${booking.consultant}`,
      },
    },
  };

  if (stripeVatTaxRateId) {
    lineItem.tax_rates = [stripeVatTaxRateId];
  }

  return lineItem;
}

async function confirmPaidBooking(session) {
  const bookings = readBookings();
  const booking = bookings.find(
    (item) => item.id === session.client_reference_id || item.id === session.metadata?.bookingId,
  );

  if (!booking || booking.status === "confirmed") {
    return;
  }

  booking.status = "confirmed";
  booking.paidAt = new Date().toISOString();
  booking.paymentStatus = session.payment_status;
  booking.stripePaymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : "";
  writeBookings(bookings);

  try {
    await sendBookingEmails(booking);
    booking.emailStatus = "sent";
    console.log(`Booking confirmation emails sent for ${booking.id}`);
  } catch (error) {
    booking.emailStatus = "failed";
    booking.emailError = error.message;
    console.error("Booking confirmed, but email failed:", error);
  }

  writeBookings(bookings);
}

async function syncPaidBookings() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { checked: 0, confirmed: 0 };
  }

  const bookings = readBookings().filter(
    (booking) => booking.status === "awaiting_payment" && booking.checkoutSessionId,
  );
  let confirmed = 0;

  for (const booking of bookings) {
    const wasConfirmed = await syncPaidBooking(booking);

    if (wasConfirmed) {
      confirmed += 1;
    }
  }

  return { checked: bookings.length, confirmed };
}

async function syncPaidBooking(booking) {
  if (!process.env.STRIPE_SECRET_KEY || !booking.checkoutSessionId) {
    return false;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(booking.checkoutSessionId);

    if (session.payment_status === "paid") {
      await confirmPaidBooking(session);
      console.log(`Stripe payment sync confirmed booking ${booking.id}`);
      return true;
    }
  } catch (error) {
    console.error(`Could not sync Stripe session for booking ${booking.id}:`, error.message);
  }

  return false;
}

async function sendBookingEmails(booking) {
  if (process.env.RESEND_API_KEY) {
    await sendBookingEmailsWithResend(booking);
    return;
  }

  if (!firmEmail || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("Email is not configured. Booking saved, but emails were not sent.");
    return;
  }

  const transporter = createEmailTransporter();

  const appointmentLine = `${booking.date} at ${booking.time}`;
  const appointmentType = booking.appointmentMode === "inPerson" ? "In person" : "Online";
  const durationLine = `${booking.duration} minutes`;
  const hilexLine = booking.hilexMember === "yes" ? "Yes - no consultation fee" : "No";
  const clientText = buildClientBookingText(booking, {
    appointmentLine,
    appointmentType,
    durationLine,
    hilexLine,
  });
  const firmText = buildFirmBookingText(booking, {
    appointmentLine,
    appointmentType,
    durationLine,
    hilexLine,
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || firmEmail,
    to: booking.email,
    subject: "Your legal consultation request is confirmed",
    text: clientText,
    html: buildClientBookingHtml(booking, {
      appointmentLine,
      appointmentType,
      durationLine,
      hilexLine,
    }),
  });

  console.log(`Client confirmation email sent to ${booking.email}`);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || firmEmail,
    to: firmEmail,
    subject: `New booking request: ${booking.fullName}`,
    text: firmText,
    html: buildFirmBookingHtml(booking, {
      appointmentLine,
      appointmentType,
      durationLine,
      hilexLine,
    }),
    attachments: (booking.documents || []).map((document) => ({
      filename: `${document.label} - ${document.originalName}`,
      path: document.path,
      contentType: document.mimeType,
    })),
  });

  console.log(`Firm booking email sent to ${firmEmail}`);
}

async function sendTestEmail() {
  if (process.env.RESEND_API_KEY) {
    const text = buildTestEmailText();

    await sendResendEmail({
      to: firmEmail,
      subject: "Forest & Co booking email test",
      text,
      html: buildTestEmailHtml("Resend"),
    });
    console.log(`Admin Resend test email sent to ${firmEmail}`);
    return;
  }

  if (!firmEmail || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("Email is not configured in Render.");
  }

  const transporter = createEmailTransporter();
  const text = buildTestEmailText();

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || firmEmail,
    to: firmEmail,
    subject: "Forest & Co booking email test",
    text,
    html: buildTestEmailHtml("SMTP"),
  });

  console.log(`Admin test email sent to ${firmEmail}`);
}

async function sendBookingEmailsWithResend(booking) {
  if (!firmEmail) {
    throw new Error("FIRM_EMAIL is not configured in Render.");
  }

  const appointmentLine = `${booking.date} at ${booking.time}`;
  const appointmentType = booking.appointmentMode === "inPerson" ? "In person" : "Online";
  const durationLine = `${booking.duration} minutes`;
  const hilexLine = booking.hilexMember === "yes" ? "Yes - no consultation fee" : "No";
  const clientText = buildClientBookingText(booking, {
    appointmentLine,
    appointmentType,
    durationLine,
    hilexLine,
  });
  const firmText = buildFirmBookingText(booking, {
    appointmentLine,
    appointmentType,
    durationLine,
    hilexLine,
  });

  await sendResendEmail({
    to: booking.email,
    subject: "Your legal consultation request is confirmed",
    text: clientText,
    html: buildClientBookingHtml(booking, {
      appointmentLine,
      appointmentType,
      durationLine,
      hilexLine,
    }),
  });
  console.log(`Client Resend confirmation email sent to ${booking.email}`);

  await sendResendEmail({
    to: firmEmail,
    subject: `New booking request: ${booking.fullName}`,
    text: firmText,
    html: buildFirmBookingHtml(booking, {
      appointmentLine,
      appointmentType,
      durationLine,
      hilexLine,
    }),
    attachments: getResendAttachments(booking),
  });
  console.log(`Firm Resend booking email sent to ${firmEmail}`);
}

async function sendResendEmail({ to, subject, text, html, attachments = [] }) {
  if (!firmEmail) {
    throw new Error("FIRM_EMAIL is not configured in Render.");
  }

  const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || firmEmail;
  const emailPayload = {
    from,
    to: [to],
    subject,
    text,
    attachments,
  };

  if (html) {
    emailPayload.html = html;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Resend could not send the email.");
  }

  return payload;
}

function getResendAttachments(booking) {
  return (booking.documents || [])
    .filter((document) => document.path && fs.existsSync(document.path))
    .map((document) => ({
      filename: `${document.label} - ${document.originalName}`,
      content: fs.readFileSync(document.path).toString("base64"),
    }));
}

function buildClientBookingText(booking, details) {
  return [
    `Dear ${booking.fullName},`,
    "",
    `Thank you for booking a consultation with Forest & Co Solicitors. Your request is confirmed for ${details.appointmentLine}.`,
    "",
    `Appointment type: ${details.appointmentType}`,
    `Consultation length: ${details.durationLine}`,
    `Area of law: ${booking.areaOfLaw || booking.caseType}`,
    `HiLex member: ${details.hilexLine}`,
    "",
    "Your consultation will be arranged with one of our available solicitors. A member of the firm will contact you if any additional details are needed.",
    "",
    "Kind regards,",
    "Forest & Co Solicitors",
    "",
    getLegalNoticeText(),
  ].join("\n");
}

function buildFirmBookingText(booking, details) {
  return [
    "A new consultation booking request was received.",
    "",
    `Name: ${booking.fullName}`,
    `Email: ${booking.email}`,
    `Phone: ${booking.phone}`,
    `Area of law: ${booking.areaOfLaw || booking.caseType}`,
    `HiLex member: ${details.hilexLine}`,
    `HiLex account email: ${booking.hilexEmail || "Not provided"}`,
    `Appointment type: ${details.appointmentType}`,
    `Consultation length: ${details.durationLine}`,
    `Assigned solicitor: ${booking.consultant || "To be assigned"}`,
    `Appointment: ${details.appointmentLine}`,
    `Proof of ID type: ${booking.idType || "Not provided"}`,
    `Uploaded documents: ${booking.documents?.length ? booking.documents.map((document) => document.label).join(", ") : "None"}`,
    "",
    "Client message:",
    booking.message || "No message provided.",
    "",
    "Kind regards,",
    "Forest & Co Booking System",
  ].join("\n");
}

function buildTestEmailText() {
  return [
    "This is a test email from the Forest & Co booking website.",
    "",
    `Sent at: ${new Date().toISOString()}`,
    "",
    "Kind regards,",
    "Forest & Co Solicitors",
    "",
    getLegalNoticeText(),
  ].join("\n");
}

function buildClientBookingHtml(booking, details) {
  return buildForestEmailHtml({
    eyebrow: "Booking confirmed",
    title: "Your consultation request is confirmed",
    intro: [
      `Dear ${escapeHtml(booking.fullName)},`,
      `Thank you for booking a consultation with Forest & Co Solicitors. Your request is confirmed for <strong>${escapeHtml(details.appointmentLine)}</strong>.`,
      "Your consultation will be arranged with one of our available solicitors. A member of the firm will contact you if any additional details are needed.",
    ],
    rows: [
      ["Appointment", details.appointmentLine],
      ["Appointment type", details.appointmentType],
      ["Consultation length", details.durationLine],
      ["Area of law", booking.areaOfLaw || booking.caseType],
      ["HiLex member", details.hilexLine],
    ],
    signOff: "Forest & Co Solicitors",
  });
}

function buildFirmBookingHtml(booking, details) {
  return buildForestEmailHtml({
    eyebrow: "New booking request",
    title: `New consultation booking: ${escapeHtml(booking.fullName)}`,
    intro: ["A new consultation booking request was received through the Forest & Co booking website."],
    rows: [
      ["Name", booking.fullName],
      ["Email", booking.email],
      ["Phone", booking.phone],
      ["Area of law", booking.areaOfLaw || booking.caseType],
      ["HiLex member", details.hilexLine],
      ["HiLex account email", booking.hilexEmail || "Not provided"],
      ["Appointment type", details.appointmentType],
      ["Consultation length", details.durationLine],
      ["Assigned solicitor", booking.consultant || "To be assigned"],
      ["Appointment", details.appointmentLine],
      ["Proof of ID type", booking.idType || "Not provided"],
      [
        "Uploaded documents",
        booking.documents?.length
          ? booking.documents.map((document) => document.label).join(", ")
          : "None",
      ],
    ],
    message: booking.message || "No message provided.",
    signOff: "Forest & Co Booking System",
    includeLegalNotice: false,
  });
}

function buildTestEmailHtml(provider) {
  return buildForestEmailHtml({
    eyebrow: "Email test",
    title: "Forest & Co booking email test",
    intro: ["This is a test email from the Forest & Co booking website."],
    rows: [
      ["Email provider", provider],
      ["Sent at", new Date().toISOString()],
    ],
    signOff: "Forest & Co Solicitors",
  });
}

function buildForestEmailHtml({
  eyebrow,
  title,
  intro = [],
  rows = [],
  message = "",
  signOff = "Forest & Co Solicitors",
  includeLegalNotice = true,
}) {
  const logoUrl = `${siteUrl.replace(/\/$/, "")}/fcos-logo.png`;
  const introHtml = intro
    .map((paragraph) => `<p style="margin:0 0 16px;color:#30334a;font-size:16px;line-height:1.65;">${paragraph}</p>`)
    .join("");
  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:13px 16px;border-bottom:1px solid #ececf4;color:#6b7087;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;width:38%;">${escapeHtml(label)}</td>
          <td style="padding:13px 16px;border-bottom:1px solid #ececf4;color:#0c0d3d;font-size:15px;font-weight:700;">${escapeHtml(value || "Not provided")}</td>
        </tr>`,
    )
    .join("");
  const messageHtml = message
    ? `<div style="margin-top:22px;padding:18px 20px;border-left:4px solid #e1007a;background:#faf9fd;color:#30334a;font-size:15px;line-height:1.6;">${escapeHtml(message)}</div>`
    : "";
  const legalNoticeHtml = includeLegalNotice
    ? `<div style="margin-top:26px;padding-top:18px;border-top:1px solid #ececf4;color:#777b8f;font-size:10.5px;line-height:1.55;">${escapeHtml(getLegalNoticeText())}</div>`
    : "";
  const contactDetailsHtml = buildContactDetailsHtml();

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5fa;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(title)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5fa;padding:32px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(12,13,61,.10);">
            <tr>
              <td style="background:#ffffff;padding:0;">
                <div style="height:9px;background:#090942;line-height:9px;font-size:0;">&nbsp;</div>
                <div style="padding:32px 42px 34px;border-bottom:1px solid #ececf4;">
                  <img src="${escapeHtml(logoUrl)}" alt="Forest & Co Legal Experts" width="142" style="display:block;max-width:142px;height:auto;margin:0 0 28px;border:0;outline:none;text-decoration:none;" />
                  <div style="color:#e1007a;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">${escapeHtml(eyebrow)}</div>
                  <h1 style="margin:0;color:#0c0d3d;font-size:30px;line-height:1.18;font-weight:800;">${title}</h1>
                  <div style="width:58px;height:4px;background:#e1007a;margin-top:22px;line-height:4px;font-size:0;">&nbsp;</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:38px 42px 34px;">
                ${introHtml}
                ${
                  rowsHtml
                    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border:1px solid #ececf4;border-collapse:collapse;background:#ffffff;">${rowsHtml}</table>`
                    : ""
                }
                ${messageHtml}
                <div style="margin-top:28px;color:#30334a;font-size:15px;line-height:1.65;">
                  Kind regards,<br />
                  <strong style="color:#0c0d3d;">${escapeHtml(signOff)}</strong>
                </div>
                ${contactDetailsHtml}
                ${legalNoticeHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function getLegalNoticeText() {
  return "IMPORTANT NOTICE: The information in this email and its attachments is confidential and may be protected by law and legal privilege. Access by anyone other than the intended addressee is not authorised. If you are not the intended addressee, please accept our apologies and notify the sender immediately. You must not discuss, disclose the contents of this email, store, copy or distribute it. Please note that neither Forest & Co nor the sender accepts any responsibility for viruses and it is your responsibility to scan the email and any attachments. Any liability arising from any third party taking action or failing to take action in view of the information provided in this email is hereby excluded. Forest & Co is a trading name of Forest Corporate Ltd, a limited company registered in England and Wales with registered number 11229601. Forest & Co is authorised and regulated by the Solicitors Regulation Authority, firm number 647302.";
}

function buildContactDetailsHtml() {
  return `
    <div style="margin-top:20px;padding-top:18px;border-top:3px solid #24256f;color:#24256f;font-size:14px;line-height:1.75;">
      <div><strong style="color:#24256f;">Phone</strong> <a href="tel:+442033830173" style="color:#222;text-decoration:underline;">+44 (0)20 3383 0173</a> <span style="color:#24256f;">&nbsp;|&nbsp;</span> <strong style="color:#24256f;">Website</strong> <a href="https://www.fcos.co.uk" style="color:#222;text-decoration:underline;">www.fcos.co.uk</a></div>
      <div><strong style="color:#24256f;">Email</strong> <a href="mailto:enquiries@fcos.co.uk" style="color:#222;text-decoration:underline;">enquiries@fcos.co.uk</a></div>
      <div><strong style="color:#24256f;">Address</strong> <span style="color:#222;text-decoration:underline;">16 Berkeley Street, W1J 8DZ, London</span></div>
    </div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createEmailTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.SMTP_REQUIRE_TLS === "true",
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 30000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 30000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 30000),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      servername: process.env.SMTP_HOST,
    },
  });
}
