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

app.get("/api/admin/availability", (request, response) => {
  if (!isValidAdminRequest(request)) {
    return response.status(401).json({ error: getAdminPinError() });
  }

  response.json(readAvailability());
});

app.get("/api/admin/bookings", (request, response) => {
  if (!isValidAdminRequest(request)) {
    return response.status(401).json({ error: getAdminPinError() });
  }

  const bookings = readBookings()
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(formatAdminBooking);

  response.json({ bookings });
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

app.get("/api/booking-status", (request, response) => {
  const sessionId = String(request.query.session_id || "");
  const booking = readBookings().find((item) => item.checkoutSessionId === sessionId);

  if (!booking) {
    return response.status(404).json({ error: "Booking was not found." });
  }

  response.json({
    status: booking.status,
    date: booking.date,
    time: booking.time,
    fullName: booking.fullName,
    email: booking.email,
    caseType: booking.caseType,
    appointmentMode: booking.appointmentMode,
    duration: booking.duration,
    consultant: booking.consultant,
  });
});

app.post(
  "/api/bookings",
  upload.fields([
    { name: "idDocument", maxCount: 1 },
    { name: "proofOfAddress", maxCount: 1 },
  ]),
  async (request, response) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    cleanupUploadedFiles(request);
    return response.status(500).json({ error: "Stripe is not configured yet." });
  }

  const booking = normalizeBooking(request.body);

  if (!booking) {
    cleanupUploadedFiles(request);
    return response.status(400).json({ error: "Please complete all required booking fields." });
  }

  if (!request.files?.idDocument?.[0] || !request.files?.proofOfAddress?.[0]) {
    cleanupUploadedFiles(request);
    return response.status(400).json({
      error: "Please upload both ID and proof of address before payment.",
    });
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
  const confirmedBooking = {
    id: bookingId,
    status: "awaiting_payment",
    createdAt: new Date().toISOString(),
    documents: collectUploadedDocuments(request),
    ...booking,
  };

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
      },
    });

    confirmedBooking.checkoutSessionId = session.id;
    bookings.push(confirmedBooking);
    writeBookings(bookings);

    response.status(201).json({
      paymentUrl: session.url,
      booking: {
        date: confirmedBooking.date,
        time: confirmedBooking.time,
        fullName: confirmedBooking.fullName,
        email: confirmedBooking.email,
        caseType: confirmedBooking.caseType,
        appointmentMode: confirmedBooking.appointmentMode,
        duration: confirmedBooking.duration,
        consultant: confirmedBooking.consultant,
      },
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
  const booking = {
    date: String(input.date || "").trim(),
    time: String(input.time || "").trim(),
    fullName: String(input.fullName || "").trim(),
    email: String(input.email || "").trim(),
    phone: String(input.phone || "").trim(),
    caseType: String(input.caseType || "").trim(),
    appointmentMode: String(input.appointmentMode || "").trim(),
    duration: String(input.duration || "").trim(),
    consultant: String(input.consultant || "").trim(),
    message: String(input.message || "").trim(),
  };

  const hasRequiredFields = Object.values(booking).every(Boolean);
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email);
  const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(booking.date);
  const hasValidTime = /^\d{2}:\d{2}$/.test(booking.time);
  const hasValidMode = ["online", "inPerson"].includes(booking.appointmentMode);
  const hasValidDuration = ["15", "30"].includes(booking.duration);
  const hasValidConsultant =
    booking.consultant === "First available solicitor" ||
    getConsultants(readAvailability()).includes(booking.consultant);

  if (
    !hasRequiredFields ||
    !hasValidEmail ||
    !hasValidDate ||
    !hasValidTime ||
    !hasValidMode ||
    !hasValidDuration ||
    !hasValidConsultant
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

function collectUploadedDocuments(request) {
  const files = request.files || {};
  const documents = [];

  if (files.idDocument?.[0]) {
    documents.push(formatUploadedDocument("ID document", files.idDocument[0]));
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
      {
        name: "Sandra Zăuleț",
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
    const consultants = input.consultants
      .map((consultant) => ({
        name: String(consultant.name || "").trim(),
        online: normalizeModeAvailability(consultant.online),
        inPerson: normalizeModeAvailability(consultant.inPerson),
      }))
      .filter((consultant) => consultant.name);

    return consultants.length ? { consultants } : null;
  }

  if (input?.online || input?.inPerson) {
    return {
      consultants: getDefaultAvailability().consultants.map((consultant) => ({
        name: consultant.name,
        online: normalizeModeAvailability(input.online),
        inPerson: normalizeModeAvailability(input.inPerson),
      })),
    };
  }

  return null;
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
  const baseAmount = booking.duration === "30" ? 28000 : 14000;
  const amount = stripeVatTaxRateId ? baseAmount : Math.round(baseAmount * (1 + vatRate / 100));
  const lineItem = {
    quantity: 1,
    price_data: {
      currency,
      unit_amount: amount,
      product_data: {
        name: `${booking.duration} minute legal consultation`,
        description: `${booking.appointmentMode === "inPerson" ? "In person" : "Online"} consultation with ${booking.consultant}`,
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

async function sendBookingEmails(booking) {
  if (!firmEmail || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("Email is not configured. Booking saved, but emails were not sent.");
    return;
  }

  const transporter = createEmailTransporter();

  const appointmentLine = `${booking.date} at ${booking.time}`;
  const appointmentType = booking.appointmentMode === "inPerson" ? "In person" : "Online";
  const durationLine = `${booking.duration} minutes`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || firmEmail,
    to: booking.email,
    subject: "Your legal consultation request is confirmed",
    text: [
      `Hello ${booking.fullName},`,
      "",
      `Your consultation request is confirmed for ${appointmentLine}.`,
      `Appointment type: ${appointmentType}`,
      `Consultation length: ${durationLine}`,
      `Consultant: ${booking.consultant}`,
      `Case type: ${booking.caseType}`,
      "",
      "A member of the firm will contact you if any additional details are needed.",
    ].join("\n"),
  });

  console.log(`Client confirmation email sent to ${booking.email}`);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || firmEmail,
    to: firmEmail,
    subject: `New booking request: ${booking.fullName}`,
    text: [
      "A new consultation booking request was received.",
      "",
      `Name: ${booking.fullName}`,
      `Email: ${booking.email}`,
      `Phone: ${booking.phone}`,
      `Case type: ${booking.caseType}`,
      `Appointment type: ${appointmentType}`,
      `Consultation length: ${durationLine}`,
      `Consultant: ${booking.consultant}`,
      `Appointment: ${appointmentLine}`,
      `Uploaded documents: ${booking.documents?.length ? booking.documents.map((document) => document.label).join(", ") : "None"}`,
      "",
      "Client message:",
      booking.message,
    ].join("\n"),
    attachments: (booking.documents || []).map((document) => ({
      filename: `${document.label} - ${document.originalName}`,
      path: document.path,
      contentType: document.mimeType,
    })),
  });

  console.log(`Firm booking email sent to ${firmEmail}`);
}

async function sendTestEmail() {
  if (!firmEmail || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("Email is not configured in Render.");
  }

  const transporter = createEmailTransporter();

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || firmEmail,
    to: firmEmail,
    subject: "Forest & Co booking email test",
    text: [
      "This is a test email from the Forest & Co booking website.",
      "",
      `Sent at: ${new Date().toISOString()}`,
    ].join("\n"),
  });

  console.log(`Admin test email sent to ${firmEmail}`);
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
