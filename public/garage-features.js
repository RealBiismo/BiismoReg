(() => {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function dateLabel(value) {
    if (!value) return "Date unavailable";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-GB");
  }

  function daysUntil(value) {
    if (!value) return null;
    const target = new Date(`${value}T00:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    return Math.ceil((target.getTime() - Date.now()) / 86400000);
  }

  function badStatus(value) {
    const text = String(value || "").toLowerCase();
    return text.includes("expired") || text.includes("untaxed") || text.includes("not valid");
  }

  function vehicleAttention(vehicle) {
    const motDays = daysUntil(vehicle.mot_expiry_date);
    const taxDays = daysUntil(vehicle.tax_due_date);
    return badStatus(vehicle.mot_status) || badStatus(vehicle.tax_status) || (motDays !== null && motDays <= 30) || (taxDays !== null && taxDays <= 30);
  }

  function nextDue(vehicles) {
    const dates = vehicles.flatMap((vehicle) => [
      { type: "MOT", registration: vehicle.registration, date: vehicle.mot_expiry_date },
      { type: "Tax", registration: vehicle.registration, date: vehicle.tax_due_date },
    ]).filter((item) => daysUntil(item.date) !== null).sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
    return dates[0] || null;
  }

  function ensureSections() {
    const garageSection = document.querySelector("#garageView .garage-section");
    if (!garageSection || document.getElementById("garageHealthSection")) return;

    const health = document.createElement("section");
    health.id = "garageHealthSection";
    health.className = "garage-health-section";
    health.innerHTML = `
      <div class="section-heading"><div><span class="eyebrow">GARAGE HEALTH</span><h2>Road-ready overview</h2></div></div>
      <div id="garageHealthGrid" class="garage-health-grid"><article class="garage-health-card"><span>Loading</span><strong>—</strong></article></div>`;

    const watch = document.createElement("section");
    watch.id = "watchlistSection";
    watch.className = "watchlist-section";
    watch.innerHTML = `
      <div class="section-heading">
        <div><span class="eyebrow">VEHICLE WATCHLIST</span><h2>Cars you’re keeping an eye on</h2></div>
        <span class="garage-limit">Maximum 10 watched vehicles</span>
      </div>
      <p class="watchlist-status" id="watchlistStatus">BIISMO checks official MOT/tax changes in the background. Push alerts use your existing notification permission.</p>
      <div id="watchlistGrid" class="watchlist-grid"></div>`;

    garageSection.before(health);
    garageSection.after(watch);
  }

  function renderHealth(vehicles) {
    const grid = document.getElementById("garageHealthGrid");
    if (!grid) return;
    const healthy = vehicles.filter((vehicle) => !vehicleAttention(vehicle)).length;
    const attention = vehicles.length - healthy;
    const due = nextDue(vehicles);
    const score = vehicles.length ? Math.max(0, Math.round((healthy / vehicles.length) * 100)) : 100;

    grid.innerHTML = `
      <article class="garage-health-card"><span>Garage health</span><strong>${score}%</strong><small>${vehicles.length ? `${healthy} of ${vehicles.length} road-ready` : "Save a vehicle to start"}</small></article>
      <article class="garage-health-card"><span>Needs attention</span><strong>${attention}</strong><small>${attention ? "MOT, tax or expiry check needed" : "Nothing urgent detected"}</small></article>
      <article class="garage-health-card"><span>Next deadline</span><strong>${due ? escapeHtml(due.type) : "—"}</strong><small>${due ? `${escapeHtml(due.registration)} · ${escapeHtml(dateLabel(due.date))}` : "No due dates available"}</small></article>`;
  }

  async function removeWatch(id, registration) {
    if (!window.confirm(`Stop watching ${registration}?`)) return;
    const response = await window.biismoAuth.authorizedFetch(`/api/watchlist/${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "That watchlist item could not be removed.");
    await loadWatchlist();
  }

  function renderWatchlist(items) {
    const grid = document.getElementById("watchlistGrid");
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = '<div class="empty-garage"><div class="empty-icon" aria-hidden="true">☆</div><h3>Your watchlist is empty</h3><p>Run a vehicle check and tap “Watch this vehicle” to monitor official MOT/tax changes without using one of your three garage spaces.</p><a class="primary-button button-link" href="/">Find a vehicle</a></div>';
      return;
    }
    grid.innerHTML = items.map((item) => `
      <article class="watch-card" data-watch-id="${escapeHtml(item.id)}">
        <div class="mini-plate"><span>GB</span>${escapeHtml(item.registration)}</div>
        <span>WATCHING OFFICIAL RECORDS</span>
        <h3>${escapeHtml(item.make || "Unknown make")} ${escapeHtml(item.model || "")}</h3>
        <p>Tax: <strong>${escapeHtml(item.taxStatus || "Unknown")}</strong> · ${escapeHtml(dateLabel(item.taxDueDate))}<br>MOT: <strong>${escapeHtml(item.motStatus || "Unknown")}</strong> · ${escapeHtml(dateLabel(item.motExpiryDate))}</p>
        <p>${item.lastCheckedAt ? `Last checked ${escapeHtml(new Date(item.lastCheckedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }))}` : "Waiting for first background refresh"}${item.lastChangedAt ? ` · Last change ${escapeHtml(new Date(item.lastChangedAt).toLocaleDateString("en-GB"))}` : ""}</p>
        <div class="watch-card-actions"><a class="card-action" href="/?reg=${encodeURIComponent(item.registration)}">View latest</a><button class="remove-watch" type="button" data-remove-watch="${escapeHtml(item.id)}" data-registration="${escapeHtml(item.registration)}">Remove</button></div>
      </article>`).join("");
    grid.querySelectorAll("[data-remove-watch]").forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true;
      try { await removeWatch(button.dataset.removeWatch, button.dataset.registration); }
      catch (error) { document.getElementById("watchlistStatus").textContent = error.message; button.disabled = false; }
    }));
  }

  async function loadWatchlist() {
    const status = document.getElementById("watchlistStatus");
    try {
      const response = await window.biismoAuth.authorizedFetch("/api/watchlist", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Watchlist could not be loaded.");
      renderWatchlist(Array.isArray(data.items) ? data.items : []);
      if (status) status.textContent = "BIISMO checks official MOT/tax changes in the background. Push alerts use your existing notification permission.";
    } catch (error) {
      if (status) status.textContent = error.message || "Watchlist could not be loaded.";
    }
  }

  async function loadGarageFeatures() {
    ensureSections();
    await window.biismoAuth.ready;
    if (!window.biismoAuth.getUser()) return;
    try {
      const vehicles = await window.biismoAuth.listSavedVehicles();
      renderHealth(vehicles || []);
    } catch {
      renderHealth([]);
    }
    await loadWatchlist();
  }

  window.addEventListener("DOMContentLoaded", loadGarageFeatures);
  window.addEventListener("biismo-auth-change", loadGarageFeatures);
})();