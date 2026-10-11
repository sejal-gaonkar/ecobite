
"use strict";

// ==========================================
// EcoBite - Food Rescue Dashboard
// ==========================================

const STORAGE_KEY = "ecobite_advanced_listings_v1";

const form = document.getElementById("foodForm");
const listingContainer = document.getElementById("foodListings");
const emptyMessage = document.getElementById("emptyMessage");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const categoryFilter = document.getElementById("categoryFilter");
const exportButton = document.getElementById("exportBtn");

const totalListingsElement = document.getElementById("totalListings");
const availableMealsElement = document.getElementById("availableMeals");
const donatedMealsElement = document.getElementById("donatedMeals");
const rescuedKgElement = document.getElementById("rescuedKg");

let listings = loadListings();

// ==========================================
// STORAGE
// ==========================================

function loadListings() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);

    if (!savedData) return [];

    const parsed = JSON.parse(savedData);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(item =>
      item &&
      typeof item.id === "string" &&
      typeof item.foodName === "string" &&
      typeof item.restaurant === "string" &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      typeof item.location === "string" &&
      typeof item.deadline === "string" &&
      typeof item.category === "string" &&
      ["Available", "Reserved", "Donated"].includes(item.status)
    );
  } catch (error) {
    console.error("Could not load EcoBite data:", error);
    return [];
  }
}

function saveListings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
    return true;
  } catch (error) {
    console.error("Could not save EcoBite data:", error);

    alert(
      "Your browser could not save the data. " +
      "Please check browser storage settings or available space."
    );

    return false;
  }
}

// ==========================================
// SAFE HTML HELPERS
// ==========================================

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return replacements[character];
  });
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString();
}

function isExpired(item) {
  return (
    item.status !== "Donated" &&
    new Date(item.deadline).getTime() <= Date.now()
  );
}

// ==========================================
// DASHBOARD STATISTICS
// ==========================================

function updateDashboard() {
  const availableListings = listings.filter(
    item => item.status === "Available" && !isExpired(item)
  );

  const donatedListings = listings.filter(
    item => item.status === "Donated"
  );

  const totalAvailableMeals = availableListings.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const totalDonatedMeals = donatedListings.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // Estimate only: 0.4 kg per donated meal.
  const estimatedRescuedKg = totalDonatedMeals * 0.4;

  totalListingsElement.textContent = listings.length;
  availableMealsElement.textContent = totalAvailableMeals;
  donatedMealsElement.textContent = totalDonatedMeals;
  rescuedKgElement.textContent = estimatedRescuedKg.toLocaleString(
    undefined,
    { maximumFractionDigits: 1 }
  );
}

// ==========================================
// RENDER FOOD LISTINGS
// ==========================================

function renderListings() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;
  const selectedCategory = categoryFilter.value;

  const filteredListings = listings.filter(item => {
    const searchableText = [
      item.foodName,
      item.restaurant,
      item.location
    ].join(" ").toLowerCase();

    const matchesSearch = searchableText.includes(searchTerm);

    const matchesStatus =
      selectedStatus === "All" ||
      item.status === selectedStatus;

    const matchesCategory =
      selectedCategory === "All" ||
      item.category === selectedCategory;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  listingContainer.innerHTML = filteredListings.map(item => {
    const expired = isExpired(item);
    const statusClass = item.status.toLowerCase();

    let actionButtons = "";

    if (item.status === "Available" && !expired) {
      actionButtons += `
        <button
          type="button"
          class="secondary-btn"
          data-action="reserve"
          data-id="${escapeHTML(item.id)}">
          Reserve
        </button>
      `;
    }

    if (item.status === "Reserved" && !expired) {
      actionButtons += `
        <button
          type="button"
          class="primary-btn"
          data-action="donate"
          data-id="${escapeHTML(item.id)}">
          Mark donated
        </button>

        <button
          type="button"
          class="secondary-btn"
          data-action="release"
          data-id="${escapeHTML(item.id)}">
          Release reservation
        </button>
      `;
    }

    if (item.status !== "Donated") {
      actionButtons += `
        <button
          type="button"
          class="danger-btn"
          data-action="delete"
          data-id="${escapeHTML(item.id)}">
          Delete
        </button>
      `;
    }

    const deadlineMessage = expired
      ? `<p class="urgent">
           Pickup deadline passed. Verify food safety before any distribution.
         </p>`
      : "";

    return `
      <article class="food-card">
        <div class="card-top">
          <span class="status ${statusClass}">
            ${escapeHTML(item.status)}
          </span>

          <span class="muted">
            ${escapeHTML(item.category)}
          </span>
        </div>

        <h3>${escapeHTML(item.foodName)}</h3>

        <p>
          <strong>${item.quantity}</strong> meals listed
        </p>

        <p>
          🏪 ${escapeHTML(item.restaurant)}
        </p>

        <p>
          📍 ${escapeHTML(item.location)}
        </p>

        <p>
          ⏰ Pickup deadline: ${escapeHTML(formatDate(item.deadline))}
        </p>

        ${deadlineMessage}

        <div class="card-actions">
          ${actionButtons}
        </div>
      </article>
    `;
  }).join("");

  emptyMessage.hidden = filteredListings.length > 0;

  if (filteredListings.length === 0) {
    emptyMessage.textContent =
      listings.length === 0
        ? "🌱 No food listings yet. Add your first donation!"
        : "No matching donations found. Try changing your search or filters.";
  }

  updateDashboard();
}

// ==========================================
// ADD A FOOD DONATION
// ==========================================

form.addEventListener("submit", function (event) {
  // Prevent the browser from reloading the page.
  event.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const foodName = document.getElementById("foodName").value.trim();
  const restaurant = document.getElementById("restaurant").value.trim();
  const quantityValue = document.getElementById("quantity").value;
  const location = document.getElementById("location").value.trim();
  const deadlineValue = document.getElementById("deadline").value;
  const category = document.getElementById("category").value;
  const safeFood = document.getElementById("safeFood").checked;

  const quantity = Number(quantityValue);
  const deadline = new Date(deadlineValue);

  // Validate the entered information.
  if (!foodName || !restaurant || !location) {
    alert("Please complete all the required fields.");
    return;
  }

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 10000
  ) {
    alert("Enter a whole number of meals between 1 and 10,000.");
    return;
  }

  if (
    !deadlineValue ||
    Number.isNaN(deadline.getTime()) ||
    deadline.getTime() <= Date.now()
  ) {
    alert("Please choose a future pickup deadline.");
    return;
  }

  if (!safeFood) {
    alert("Please confirm the food safety declaration.");
    return;
  }

  const newListing = {
    id: createId(),
    foodName,
    restaurant,
    quantity,
    location,
    deadline: deadline.toISOString(),
    category,
    status: "Available",
    createdAt: new Date().toISOString()
  };

  // Save the listing only if browser storage succeeds.
  listings.unshift(newListing);

  if (!saveListings()) {
    listings.shift();
    return;
  }

  // Reset the form after a successful save.
  form.reset();

  // Show the newly added listing even if filters were active.
  searchInput.value = "";
  statusFilter.value = "All";
  categoryFilter.value = "All";

  renderListings();

  // Return to the listings area.
  listingContainer.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return "food-" +
    Date.now() + "-" +
    Math.random().toString(36).slice(2, 10);
}

// ==========================================
// RESERVE, DONATE, RELEASE AND DELETE
// ==========================================

listingContainer.addEventListener("click", function (event) {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  const item = listings.find(entry => entry.id === id);

  if (!item) {
    alert("This listing could not be found. Refresh the page and try again.");
    return;
  }

  const previousStatus = item.status;
  let deleteIndex = -1;

  switch (action) {
    case "reserve":
      if (item.status !== "Available" || isExpired(item)) {
        alert("This listing is no longer available for reservation.");
        return;
      }

      item.status = "Reserved";
      break;

    case "release":
      if (item.status !== "Reserved" || isExpired(item)) {
        alert("This reservation cannot be released.");
        return;
      }

      item.status = "Available";
      break;

    case "donate":
      if (item.status !== "Reserved" || isExpired(item)) {
        alert("This listing cannot be marked as donated.");
        return;
      }

      if (
        !confirm(
          "Confirm that the food has actually been handed over?"
        )
      ) {
        return;
      }

      item.status = "Donated";
      item.donatedAt = new Date().toISOString();
      break;

    case "delete":
      if (item.status === "Donated") {
        alert("Completed donation records are kept for reporting.");
        return;
      }

      if (!confirm("Are you sure you want to delete this listing?")) {
        return;
      }

      deleteIndex = listings.findIndex(entry => entry.id === id);

      if (deleteIndex === -1) return;

      listings.splice(deleteIndex, 1);
      break;

    default:
      return;
  }

  if (!saveListings()) {
    // Undo the in-memory change if persistence failed.
    if (deleteIndex !== -1) {
      listings.splice(deleteIndex, 0, item);
    } else {
      item.status = previousStatus;

      if (action === "donate") {
        delete item.donatedAt;
      }
    }

    renderListings();
    return;
  }

  renderListings();
});

// ==========================================
// SEARCH AND FILTERS
// ==========================================

searchInput.addEventListener("input", renderListings);
statusFilter.addEventListener("change", renderListings);
categoryFilter.addEventListener("change", renderListings);

// ==========================================
// EXPORT CSV REPORT
// ==========================================

exportButton.addEventListener("click", function () {
  if (listings.length === 0) {
    alert("There are no donation records to export yet.");
    return;
  }

  const columns = [
    "Food Name",
    "Restaurant",
    "Quantity",
    "Location",
    "Category",
    "Pickup Deadline",
    "Status",
    "Created At",
    "Donated At"
  ];

  const rows = listings.map(item => [
    item.foodName,
    item.restaurant,
    item.quantity,
    item.location,
    item.category,
    item.deadline,
    item.status,
    item.createdAt,
    item.donatedAt || ""
  ]);

  // Escape quotes, commas, and line breaks correctly.
  function csvCell(value) {
    return '"' + String(value ?? "").replace(/"/g, '""') + '"';
  }

  const csvContent = [columns, ...rows]
    .map(row => row.map(csvCell).join(","))
    .join("\r\n");

  const blob = new Blob(
    ["\uFEFF" + csvContent],
    { type: "text/csv;charset=utf-8;" }
  );

  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = "ecobite-donation-report.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
});

// ==========================================
// START THE APPLICATION
// ==========================================

renderListings();

console.log("EcoBite dashboard initialized successfully.");

