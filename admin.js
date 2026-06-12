const loginForm = document.querySelector("#adminLogin");
const editorForm = document.querySelector("#adminEditor");
const consultantList = document.querySelector("#consultantList");
const consultantTemplate = document.querySelector("#consultantTemplate");
const addConsultantButton = document.querySelector("#addConsultant");
const adminStatus = document.querySelector("#adminStatus");

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
  adminPin = new FormData(loginForm).get("pin");
  await loadAvailability();
  loginForm.hidden = true;
  editorForm.hidden = false;
});

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
      body: JSON.stringify(availability),
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

async function loadAvailability() {
  const response = await fetch("/api/availability");
  availability = await response.json();
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
