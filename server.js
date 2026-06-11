require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const nodemailer = require("nodemailer");

const app = express();
const publicDir = __dirname;
const dataDir = path.join(__dirname, "data");
const bookingsPath = path.join(dataDir, "bookings.json");

const port = Number(process.env.PORT || 4242);
const firmEmail = process.env.FIRM_EMAIL || "";

fs.mkdirSync(dataDir, { recursive: true });

app.use(express.json());
app.use(express.static(publicDir));

app.get("/api/booked-slots", (request, response) => {
  const bookedSlots = readBookings()
    .filter((booking) => booking.status === "confirmed")
    .map((booking) => ({ date: booking.date, time: booking.time }));

  response.json(bookedSlots);
});

app.post("/api/bookings", async (request, response) => {
  const booking = normalizeBooking(request.body);

  if (!booking) {
    return response.status(400).json({ error: "Please complete all required booking fields." });
  }

  const bookings = readBookings();
  const slotTaken = bookings.some(
    (item) =>
      item.status === "confirmed" &&
      item.date === booking.date &&
      item.time === booking.time,
  );

  if (slotTaken) {
    return response.status(409).json({ error: "That appointment time is no longer available." });
  }

  const confirmedBooking = {
    id: crypto.randomUUID(),
    status: "confirmed",
    createdAt: new Date().toISOString(),
    ...booking,
  };

  bookings.push(confirmedBooking);
  writeBookings(bookings);

  try {
    await sendBookingEmails(confirmedBooking);
  } catch (error) {
    console.error("Booking email error:", error);
  }

  response.status(201).json({
    booking: {
      date: confirmedBooking.date,
      time: confirmedBooking.time,
      fullName: confirmedBooking.fullName,
      email: confirmedBooking.email,
      caseType: confirmedBooking.caseType,
    },
  });
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
    message: String(input.message || "").trim(),
  };

  const hasRequiredFields = Object.values(booking).every(Boolean);
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email);
  const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(booking.date);
  const hasValidTime = /^\d{2}:\d{2}$/.test(booking.time);

  if (!hasRequiredFields || !hasValidEmail || !hasValidDate || !hasValidTime) {
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

async function sendBookingEmails(booking) {
  if (!firmEmail || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("Email is not configured. Booking saved, but emails were not sent.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const appointmentLine = `${booking.date} at ${booking.time}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || firmEmail,
    to: booking.email,
    subject: "Your legal consultation request is confirmed",
    text: [
      `Hello ${booking.fullName},`,
      "",
      `Your consultation request is confirmed for ${appointmentLine}.`,
      `Case type: ${booking.caseType}`,
      "",
      "A member of the firm will contact you if any additional details are needed.",
    ].join("\n"),
  });

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
      `Appointment: ${appointmentLine}`,
      "",
      "Client message:",
      booking.message,
    ].join("\n"),
  });
}
