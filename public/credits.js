const storeCreditBalance = document.getElementById("storeCreditBalance");
const creditPackGrid = document.getElementById("creditPackGrid");
const purchaseStatus = document.getElementById("purchaseStatus");
const purchaseHistoryList = document.getElementById("purchaseHistoryList");
const loadingOverlay = document.getElementById("loadingOverlay");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setLoading(visible) {
  loadingOverlay.classList.toggle("is-visible", visible);
  loadingOverlay.setAttribute("aria-hidden", String(!visible));
}

function setPurchaseStatus(message, type = "") {
  purchaseStatus.textContent = message;
  purchaseStatus.className = `purchase-status ${type ? `is-${type}` : ""}`.trim();
}

function formatMoney(amountPence, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(Number(amountPence || 0) / 100);
}

function formatPurchaseDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function loadBalance() {
  const response = await window.biismoAuth.authorizedFetch("/api/allowance", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Your credit balance could not be loaded.");
  storeCreditBalance.textContent = String(Number(data.credits) || 0);
}

async function loadPurchaseHistory() {
  const response = await window.biismoAuth.authorizedFetch("/api/credits/purchases", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Your purchase history could not be loaded.");
  const purchases = Array.isArray(data.purchases) ? data.purchases : [];
  purchaseHistoryList.innerHTML = purchases.length
    ? purchases.map((purchase) => `
      <article class="purchase-history-item">
        <div><strong>${Number(purchase.credits) || 0} credits</strong><span>${escapeHtml(formatMoney(purchase.amountPence, purchase.currency))}</span></div>
        <time datetime="${escapeHtml(purchase.createdAt)}">${escapeHtml(formatPurchaseDate(purchase.createdAt))}</time>
      </article>`).join("")
    : "<p>No purchases yet.</p>";
}

async function startCheckout(bundleId, button) {
  const buttons = [...creditPackGrid.querySelectorAll("button")];
  buttons.forEach((item) => { item.disabled = true; });
  button.textContent = "Opening secure checkout…";
  setPurchaseStatus("Connecting securely to Stripe…");
  try {
    const response = await window.biismoAuth.authorizedFetch("/api/credits/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundleId }),
    });
    const data = await response.json();
    if (!response.ok || !data.url) throw new Error(data.error || "Checkout could not be opened.");
    window.location.assign(data.url);
  } catch (error) {
    setPurchaseStatus(error.message || "Checkout could not be opened.", "error");
    buttons.forEach((item) => { item.disabled = false; });
    button.textContent = "Buy securely";
  }
}

async function loadStore() {
  const response = await fetch("/api/credits/store", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Credit packs could not be loaded.");
  const bundles = Array.isArray(data.bundles) ? data.bundles : [];
  creditPackGrid.innerHTML = bundles.map((bundle) => `
    <article class="credit-pack ${bundle.id === "popular" ? "is-featured" : ""}">
      <span class="credit-pack-label">${escapeHtml(bundle.label)}</span>
      <strong>${Number(bundle.credits) || 0}<small> credits</small></strong>
      <p>${Number(bundle.searches) || 0} extra vehicle checks</p>
      <div class="credit-pack-price">${escapeHtml(formatMoney(bundle.amountPence, data.currency))}</div>
      <button class="primary-button" type="button" data-bundle-id="${escapeHtml(bundle.id)}" ${data.enabled ? "" : "disabled"}>${data.enabled ? "Buy securely" : "Coming soon"}</button>
    </article>`).join("");

  if (!data.enabled) {
    setPurchaseStatus("The credit store is built and waiting for the Stripe account to be connected.");
  }
}

creditPackGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-bundle-id]");
  if (button && !button.disabled) startCheckout(button.dataset.bundleId, button);
});

document.getElementById("signOutButton").addEventListener("click", async () => {
  setLoading(true);
  try {
    await window.biismoAuth.signOut();
    window.location.replace("/");
  } catch (error) {
    setLoading(false);
    setPurchaseStatus(error.message || "Sign out failed.", "error");
  }
});

async function initializeStore() {
  await window.biismoAuth.ready;
  if (!window.biismoAuth.isConfigured() || !window.biismoAuth.getUser()) {
    window.location.replace("/?login=1");
    return;
  }

  const purchaseResult = new URLSearchParams(window.location.search).get("purchase");
  if (purchaseResult === "success") {
    setPurchaseStatus("Payment received. Your credits will appear automatically in a moment.", "success");
  } else if (purchaseResult === "cancelled") {
    setPurchaseStatus("Checkout cancelled. You have not been charged.");
  }

  try {
    await Promise.all([loadStore(), loadBalance(), loadPurchaseHistory()]);
    if (purchaseResult === "success") {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        await Promise.all([loadBalance(), loadPurchaseHistory()]);
      }
    }
  } catch (error) {
    setPurchaseStatus(error.message || "The credit store could not be loaded.", "error");
  } finally {
    setLoading(false);
  }
}

initializeStore();
