// Keep the Garage compatible with renamed UI IDs before account.js executes.
if (window.location.pathname === "/account.html") {
  const nativeGetById = Document.prototype.getElementById;
  const aliases = {
    garageGrid: "savedVehicles",
    vehicleCount: "savedVehicleCount",
    reminderToggleButton: "enableNotificationsButton",
    adminStatus: "adminUserStatus",
  };

  const legacyAdminFields = new Set([
    "selectedUserFreeRemaining",
    "selectedUserFreeUsed",
    "selectedUserPushDevices",
    "adminAccountStatusBadge",
  ]);

  function getLegacyAdminField(id) {
    let node = nativeGetById.call(document, `legacyCompat_${id}`);
    if (node) return node;
    node = document.createElement("span");
    node.id = `legacyCompat_${id}`;
    node.hidden = true;
    node.setAttribute("aria-hidden", "true");
    (nativeGetById.call(document, "adminUserResult") || document.body).append(node);
    return node;
  }

  Document.prototype.getElementById = function biismoCompatibleGetElementById(id) {
    const direct = nativeGetById.call(this, id);
    if (direct) return direct;
    if (aliases[id]) return nativeGetById.call(this, aliases[id]);
    if (legacyAdminFields.has(id)) return getLegacyAdminField(id);
    if (id === "adminUserSearchButton") {
      return this.querySelector('#adminUserSearchForm button[type="submit"]');
    }
    if (id === "garageStatus") {
      let status = nativeGetById.call(this, "garageStatusCompat");
      if (!status) {
        status = this.createElement("p");
        status.id = "garageStatusCompat";
        status.className = "garage-status";
        const grid = nativeGetById.call(this, "savedVehicles");
        grid?.parentElement?.insertBefore(status, grid);
      }
      return status;
    }
    return null;
  };

  window.setTimeout(() => {
    const overlay = nativeGetById.call(document, "loadingOverlay");
    if (!overlay?.classList.contains("is-visible")) return;
    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    window.setTimeout(() => overlay.remove(), 250);
  }, 6500);
}

(() => {
  const splash = document.getElementById("appSplash");
  if (!splash) return;

  const sessionKey = "biismo-splash-seen-v1";
  let alreadySeen = false;

  try {
    alreadySeen = window.sessionStorage.getItem(sessionKey) === "true";
    if (!alreadySeen) window.sessionStorage.setItem(sessionKey, "true");
  } catch {}

  if (alreadySeen) {
    splash.remove();
    return;
  }

  const startedAt = window.performance.now();
  let dismissing = false;

  const dismiss = () => {
    if (dismissing) return;
    dismissing = true;
    const minimumDisplayTime = 1450;
    const remaining = Math.max(0, minimumDisplayTime - (window.performance.now() - startedAt));
    window.setTimeout(() => {
      splash.classList.add("is-leaving");
      window.setTimeout(() => splash.remove(), 500);
    }, remaining);
  };

  if (document.readyState === "complete") dismiss();
  else window.addEventListener("load", dismiss, { once: true });
  window.setTimeout(dismiss, 3500);
})();

const referralStyles = document.createElement("link");
referralStyles.rel = "stylesheet";
referralStyles.href = "/referral.css";
document.head.append(referralStyles);
import("/referral.js").catch(() => {});

const aiEntryStyles = document.createElement("link");
aiEntryStyles.rel = "stylesheet";
aiEntryStyles.href = "/ai-mechanic.css";
document.head.append(aiEntryStyles);
import("/ai-entry.js").catch(() => {});

if (window.location.pathname === "/" || window.location.pathname === "/index.html") {
  const resultStyles = document.createElement("link");
  resultStyles.rel = "stylesheet";
  resultStyles.href = "/result-compact.css";
  document.head.append(resultStyles);
}

if (window.location.pathname === "/account.html") {
  const garageHubStyles = document.createElement("link");
  garageHubStyles.rel = "stylesheet";
  garageHubStyles.href = "/garage-hub.css";
  document.head.append(garageHubStyles);

  const garageFixStyles = document.createElement("link");
  garageFixStyles.rel = "stylesheet";
  garageFixStyles.href = "/garage-hub-fixes.css";
  document.head.append(garageFixStyles);

  // Load staff modules independently so one optional module can never block the rest.
  import("/moderator-controls.js").catch(() => {});
  import("/staff-user-directory.js").catch(() => {});
  import("/staff-dashboard-organizer.js").catch(() => {});
  import("/admin-ai-logs.js").catch(() => {});
  import("/plan-entitlement-ui.js").catch(() => {});

  const loadGarageHub = () => import("/garage-hub.js")
    .then(() => import("/garage-hub-fixes.js"))
    .then(() => import("/garage-photo-any.js"))
    .then(() => import("/garage-photo-unrestricted.js"))
    .catch(() => {});

  const loadPhotoDisplay = () => import("/garage-photo-display-fix.js").catch(() => {});

  if (document.readyState === "complete") {
    loadGarageHub();
    loadPhotoDisplay();
  } else {
    window.addEventListener("load", loadGarageHub, { once: true });
    window.addEventListener("load", loadPhotoDisplay, { once: true });
  }
}
