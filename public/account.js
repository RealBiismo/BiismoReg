const garageGrid = document.getElementById("garageGrid");
const garageStatus = document.getElementById("garageStatus");
const vehicleCount = document.getElementById("vehicleCount");
const accountEmail = document.getElementById("accountEmail");
const loadingOverlay = document.getElementById("loadingOverlay");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString("en-GB");
}

function setLoading(visible, title = "Opening your garage", message = "Loading your securely saved vehicles…") {
  loadingOverlay.classList.toggle("is-visible", visible);
  loadingOverlay.setAttribute("aria-hidden", String(!visible));
  loadingOverlay.querySelector("strong").textContent = title;
  loadingOverlay.querySelector("span").textContent = message;
}

function renderEmptyGarage() {
  garageGrid.innerHTML = `
    <div class="empty-garage">
      <div class="empty-icon" aria-hidden="true">＋</div>
      <h3>Your garage is empty</h3>
      <p>Run a vehicle check, then choose “Save to garage” to keep it here.</p>
      <a class="primary-button button-link" href="/">Check a vehicle</a>
    </div>
  `;
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("untaxed") || value.includes("expired") || value.includes("not valid")) return "is-bad";
  if (value.includes("taxed") || value.includes("valid")) return "is-good";
  return "is-neutral";
}

function renderVehicles(vehicles) {
  vehicleCount.textContent = `${vehicles.length} ${vehicles.length === 1 ? "vehicle" : "vehicles"}`;
  garageStatus.textContent = "";

  if (vehicles.length === 0) {
    renderEmptyGarage();
    return;
  }

  garageGrid.innerHTML = vehicles
    .map(
      (vehicle) => `
        <article class="garage-card" data-vehicle-id="${escapeHtml(vehicle.id)}">
          <div class="garage-card-top">
            <div class="mini-plate"><span>GB</span>${escapeHtml(vehicle.registration)}</div>
            <button class="remove-vehicle" type="button" data-remove-id="${escapeHtml(vehicle.id)}" aria-label="Remove ${escapeHtml(vehicle.registration)} from garage">×</button>
          </div>
          <h3>${escapeHtml(vehicle.make || "Unknown make")} ${escapeHtml(vehicle.model || "")}</h3>
          <p class="vehicle-meta">${escapeHtml(vehicle.colour || "Colour unknown")}${vehicle.last_mileage ? ` · ${Number(vehicle.last_mileage).toLocaleString()} miles` : ""}</p>

          <div class="garage-status-grid">
            <div>
              <span>Tax</span>
              <strong class="${statusClass(vehicle.tax_status)}">${escapeHtml(vehicle.tax_status || "Unknown")}</strong>
              <small>${escapeHtml(formatDate(vehicle.tax_due_date))}</small>
            </div>
            <div>
              <span>MOT</span>
              <strong class="${statusClass(vehicle.mot_status)}">${escapeHtml(vehicle.mot_status || "See latest check")}</strong>
              <small>${escapeHtml(formatDate(vehicle.mot_expiry_date))}</small>
            </div>
          </div>

          <a class="card-action" href="/?reg=${encodeURIComponent(vehicle.registration)}">
            View latest check <span aria-hidden="true">→</span>
          </a>
        </article>
      `
    )
    .join("");

  document.querySelectorAll("[data-remove-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest(".garage-card");
      const registration = card.querySelector(".mini-plate").textContent.replace("GB", "").trim();
      if (!window.confirm(`Remove ${registration} from your garage?`)) return;

      button.disabled = true;
      try {
        await window.biismoAuth.removeSavedVehicle(button.dataset.removeId);
        card.remove();
        const remaining = document.querySelectorAll(".garage-card").length;
        vehicleCount.textContent = `${remaining} ${remaining === 1 ? "vehicle" : "vehicles"}`;
        if (remaining === 0) renderEmptyGarage();
      } catch (error) {
        garageStatus.textContent = error.message || "That vehicle could not be removed.";
        button.disabled = false;
      }
    });
  });
}

async function loadGarage() {
  await window.biismoAuth.ready;

  if (!window.biismoAuth.isConfigured()) {
    setLoading(false);
    accountEmail.textContent = "Account setup is not complete yet.";
    garageStatus.textContent = "Add the Supabase project URL and public key to enable secure accounts.";
    renderEmptyGarage();
    return;
  }

  const user = window.biismoAuth.getUser();
  if (!user) {
    window.location.replace("/?login=1");
    return;
  }

  accountEmail.textContent = user.email || "Signed in securely";

  try {
    const vehicles = await window.biismoAuth.listSavedVehicles();
    renderVehicles(vehicles);
  } catch (error) {
    garageStatus.textContent = error.message || "Your saved vehicles could not be loaded.";
    garageGrid.innerHTML = "";
  } finally {
    setLoading(false);
  }
}

document.getElementById("garageSearchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const registration = document
    .getElementById("garageRegInput")
    .value.toUpperCase()
    .replace(/[\s-]/g, "");

  if (!/^[A-Z0-9]{2,8}$/.test(registration) || !/[A-Z]/.test(registration) || !/[0-9]/.test(registration)) {
    garageStatus.textContent = "Enter a valid UK registration number.";
    return;
  }

  window.location.href = `/?reg=${encodeURIComponent(registration)}`;
});

document.getElementById("signOutButton").addEventListener("click", async () => {
  setLoading(true, "Signing you out", "Ending the secure session…");
  try {
    await window.biismoAuth.signOut();
    window.location.replace("/");
  } catch (error) {
    setLoading(false);
    garageStatus.textContent = error.message || "Sign out failed. Please try again.";
  }
});

loadGarage();
