const loginForm = document.querySelector("#adminLogin");
const editorForm = document.querySelector("#adminEditor");
const adminWorkspace = document.querySelector("#adminWorkspace");
const adminBookings = document.querySelector("#adminBookings");
const adminEmailTest = document.querySelector("#adminEmailTest");
const consultantList = document.querySelector("#consultantList");
const consultantTemplate = document.querySelector("#consultantTemplate");
const bookingAdminTemplate = document.querySelector("#bookingAdminTemplate");
const addConsultantButton = document.querySelector("#addConsultant");
const refreshBookingsButton = document.querySelector("#refreshBookings");
const syncPaymentsButton = document.querySelector("#syncPayments");
const sendTestEmailButton = document.querySelector("#sendTestEmail");
const adminStatus = document.querySelector("#adminStatus");
const bookingStatus = document.querySelector("#bookingStatus");
const emailTestStatus = document.querySelector("#emailTestStatus");
const bookingList = document.querySelector("#bookingList");

const days = [
  ["1", "Mon"],
  ["2", "Tue"],
  ["3", "Wed"],
  ["4", "Thu"],
  ["5", "Fri"],
  ["6", "Sat"],
  ["0", "Sun"],
];

let adminPin = "";
let availability = { consultants: [] };

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminPin = String(new FormData(loginForm).get("pin") || "").trim();

  try {
    await loadAvailability(true);
    loginForm.hidden = true;
    adminWorkspace.hidden = false;
    await loadBookings();
  } catch (error) {
    adminStatus.textContent = error.message;
  }
});

document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", async () => {
    document.querySelectorAll(".admin-tab").forEach((item) => item.classList.remove("is-active"));
    tab.classList.add("is-active");

    const activeTab = tab.dataset.tab;
    editorForm.hidden = activeTab !== "availability";
    adminBookings.hidden = activeTab !== "bookings";
    adminEmailTest.hidden = activeTab !== "email";

    if (activeTab === "bookings") {
      await loadBookings();
    }
  });
});

refreshBookingsButton.addEventListener("click", loadBookings);
syncPaymentsButton.addEventListener("click", syncPayments);
sendTestEmailButton.addEventListener("click", sendTestEmail);

addConsultantButton.addEventListener("click", () => {
  availability.consultants.push({
    name: "New solicitor",
    online: { weekdays: [1, 2, 3, 4, 5], times: ["09:00"] },
    inPerson: { weekdays: [2, 3, 4], times: ["10:00"] },
  });
  renderAvailability();
});

editorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminStatus.textContent = "";
  availability = collectAvailability();

  try {
    const response = await fetch("/api/admin/availability", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Pin": adminPin,
      },
      body: JSON.stringify({
        pin: adminPin,
        availability,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not save availability.");
    }

    availability = payload.availability;
    renderAvailability();
    adminStatus.textContent = "Availability saved.";
  } catch (error) {
    adminStatus.textContent = error.message;
  }
});

async function loadAvailability(validatePin = false) {
  const url = validatePin
    ? `/api/admin/availability?pin=${encodeURIComponent(adminPin)}`
    : "/api/availability";
  const response = await fetch(url, {
    headers: validatePin ? { "X-Admin-Pin": adminPin } : {},
  });
  availability = await response.json();

  if (!response.ok) {
    throw new Error(availability.error || "Could not load availability.");
  }

  renderAvailability();
}

function renderAvailability() {
  consultantList.innerHTML = "";

  availability.consultants.forEach((consultant, index) => {
    const card = consultantTemplate.content.cloneNode(true);
    const root = card.querySelector(".consultant-card");
    const nameInput = card.querySelector(".consultant-name");

    root.dataset.index = index;
    nameInput.value = consultant.name;

    card.querySelector(".remove-consultant").addEventListener("click", () => {
      availability.consultants.splice(index, 1);
      renderAvailability();
    });

    card.querySelectorAll(".mode-card").forEach((modeCard) => {
      const mode = modeCard.dataset.mode;
      const modeAvailability = consultant[mode] || { weekdays: [], times: [] };
      const daysContainer = modeCard.querySelector(".admin-days");
      const timesInput = modeCard.querySelector(".admin-times");

      days.forEach(([value, label]) => {
        const dayLabel = document.createElement("label");
        dayLabel.className = "day-toggle";
        dayLabel.innerHTML = `
          <input type="checkbox" value="${value}" ${modeAvailability.weekdays.includes(Number(value)) ? "checked" : ""}>
          <span>${label}</span>
        `;
        daysContainer.appendChild(dayLabel);
      });

      timesInput.value = modeAvailability.times.join(", ");
    });

    consultantList.appendChild(card);
  });
}

function collectAvailability() {
  return {
    consultants: [...consultantList.querySelectorAll(".consultant-card")].map((card) => {
      const consultant = {
        name: card.querySelector(".consultant-name").value.trim(),
        online: collectMode(card, "online"),
        inPerson: collectMode(card, "inPerson"),
      };

      return consultant;
    }),
  };
}

function collectMode(card, mode) {
  const modeCard = card.querySelector(`[data-mode="${mode}"]`);
  const weekdays = [...modeCard.querySelectorAll('.admin-days input:checked')].map((input) =>
    Number(input.value),
  );
  const times = modeCard
    .querySelector(".admin-times")
    .value.split(/[\n,]+/)
    .map((time) => time.trim())
    .filter(Boolean);

  return { weekdays, times };
}

async function loadBookings() {
  bookingList.innerHTML = '<p class="admin-empty">Loading bookings...</p>';
  bookingStatus.textContent = "";

  try {
    const response = await fetch(`/api/admin/bookings?pin=${encodeURIComponent(adminPin)}`, {
      headers: { "X-Admin-Pin": adminPin },
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not load bookings.");
    }

    renderBookings(payload.bookings || []);
  } catch (error) {
    bookingList.innerHTML = `<p class="admin-empty">${error.message}</p>`;
  }
}

async function syncPayments() {
  bookingStatus.textContent = "Checking Stripe payments...";
  syncPaymentsButton.disabled = true;

  try {
    const response = await fetch("/api/admin/sync-payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Pin": adminPin,
      },
      body: JSON.stringify({ pin: adminPin }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not sync Stripe payments.");
    }

    bookingStatus.textContent = `Checked ${payload.checked} booking(s). Confirmed ${payload.confirmed} paid booking(s).`;
    await loadBookings();
  } catch (error) {
    bookingStatus.textContent = error.message;
  } finally {
    syncPaymentsButton.disabled = false;
  }
}

function renderBookings(bookings) {
  bookingList.innerHTML = "";

  if (!bookings.length) {
    bookingList.innerHTML = '<p class="admin-empty">No bookings yet.</p>';
    return;
  }

  bookings.forEach((booking) => {
    const card = bookingAdminTemplate.content.cloneNode(true);
    card.querySelector(".booking-client").textContent = booking.fullName;
    card.querySelector(".booking-meta").textContent =
      `${booking.date} at ${booking.time} · ${booking.duration} min · ${formatMode(booking.appointmentMode)}`;
    card.querySelector(".booking-status").textContent = booking.status.replace("_", " ");

    card.querySelector(".booking-details").innerHTML = [
      ["Consultant", booking.consultant],
      ["Case type", booking.caseType],
      ["Email", booking.email],
      ["Phone", booking.phone],
      ["Payment", booking.paymentStatus || "Not completed"],
      ["Email status", booking.emailStatus || "Not sent"],
      ["Created", formatDateTime(booking.createdAt)],
      ["Paid", booking.paidAt ? formatDateTime(booking.paidAt) : "-"],
    ]
      .map(([label, value]) => `<div><dt>${label}</dt><dd>${value || "-"}</dd></div>`)
      .join("");

    card.querySelector(".booking-message").textContent = booking.message || "";

    const documents = card.querySelector(".booking-documents");
    documents.innerHTML = "<h4>Documents</h4>";

    if (!booking.documents?.length) {
      documents.insertAdjacentHTML("beforeend", '<p class="admin-empty">No documents uploaded.</p>');
    } else {
      booking.documents.forEach((uploadedDocument) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "document-button";
        button.disabled = !uploadedDocument.available;
        button.textContent = uploadedDocument.available
          ? `Download ${uploadedDocument.label}`
          : `${uploadedDocument.label} unavailable`;
        button.addEventListener("click", () =>
          downloadDocument(booking.id, uploadedDocument.index, uploadedDocument.originalName),
        );
        documents.appendChild(button);
      });
    }

    if (booking.status === "confirmed") {
      const resendButton = document.createElement("button");
      resendButton.type = "button";
      resendButton.className = "document-button";
      resendButton.textContent = "Resend confirmation emails";
      resendButton.addEventListener("click", () => resendBookingEmail(booking.id, resendButton));
      documents.appendChild(resendButton);
    }

    bookingList.appendChild(card);
  });
}

async function downloadDocument(bookingId, documentIndex, filename) {
  const response = await fetch(
    `/api/admin/bookings/${bookingId}/documents/${documentIndex}?pin=${encodeURIComponent(adminPin)}`,
    { headers: { "X-Admin-Pin": adminPin } },
  );

  if (!response.ok) {
    alert("Could not download document.");
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "document";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function sendTestEmail() {
  emailTestStatus.textContent = "Sending test email...";
  sendTestEmailButton.disabled = true;

  try {
    const response = await fetch("/api/admin/test-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Pin": adminPin,
      },
      body: JSON.stringify({ pin: adminPin }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not send test email.");
    }

    emailTestStatus.textContent = payload.message || "Test email sent.";
  } catch (error) {
    emailTestStatus.textContent = error.message;
  } finally {
    sendTestEmailButton.disabled = false;
  }
}

async function resendBookingEmail(bookingId, button) {
  button.disabled = true;
  button.textContent = "Sending emails...";

  try {
    const response = await fetch(`/api/admin/bookings/${bookingId}/resend-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Pin": adminPin,
      },
      body: JSON.stringify({ pin: adminPin }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not resend emails.");
    }

    button.textContent = "Emails sent";
    await loadBookings();
  } catch (error) {
    button.textContent = error.message;
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.textContent = "Resend confirmation emails";
    }, 2500);
  }
}

function formatMode(mode) {
  return mode === "inPerson" ? "In person" : "Online";
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
