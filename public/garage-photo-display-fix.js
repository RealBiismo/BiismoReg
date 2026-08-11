(() => {
  const grid = document.getElementById("garageGrid");
  if (!grid || !window.biismoAuth) return;

  let client = null;
  const objectUrls = new WeakMap();
  const refreshTimers = new WeakMap();

  function registrationFromCard(card) {
    return String(card.dataset.registration || card.querySelector(".mini-plate")?.textContent || "")
      .replace(/^GB/i, "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
  }

  function setPhoto(card, url) {
    const image = card.querySelector("[data-vehicle-photo]");
    const placeholder = card.querySelector("[data-photo-placeholder]");
    if (!image || !url) return false;

    image.src = url;
    image.hidden = false;
    image.style.display = "block";
    image.style.visibility = "visible";
    image.style.opacity = "1";
    if (placeholder) {
      placeholder.hidden = true;
      placeholder.style.display = "none";
    }
    return true;
  }

  function clearPreviousObjectUrl(card) {
    const previous = objectUrls.get(card);
    if (previous) {
      URL.revokeObjectURL(previous);
      objectUrls.delete(card);
    }
  }

  async function displayPhoto(card, path) {
    if (!path) return false;

    // Use an authenticated Storage download first. This avoids Safari/PWA
    // signed-URL quirks and keeps the bucket private.
    try {
      const { data, error } = await client.storage.from("vehicle-photos").download(path);
      if (!error && data) {
        clearPreviousObjectUrl(card);
        const url = URL.createObjectURL(data);
        objectUrls.set(card, url);
        return setPhoto(card, url);
      }
    } catch {}

    // Signed URL remains a fallback if direct authenticated download fails.
    try {
      const { data, error } = await client.storage.from("vehicle-photos").createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) return setPhoto(card, data.signedUrl);
    } catch {}

    return false;
  }

  async function refreshCard(card) {
    const registration = registrationFromCard(card);
    if (!registration || card.classList.contains("is-photo-uploading")) return;

    try {
      const { data, error } = await client
        .from("vehicle_profiles")
        .select("photo_path")
        .eq("registration", registration)
        .maybeSingle();
      if (error || !data?.photo_path) return;
      await displayPhoto(card, data.photo_path);
    } catch {}
  }

  function scheduleRefresh(card, delay = 100) {
    const existing = refreshTimers.get(card);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      refreshTimers.delete(card);
      refreshCard(card);
    }, delay);
    refreshTimers.set(card, timer);
  }

  function decorate(card) {
    if (!card.querySelector("[data-vehicle-photo]")) return;
    if (card.dataset.photoDisplayFixReady !== "true") {
      card.dataset.photoDisplayFixReady = "true";
      scheduleRefresh(card, 0);
    }
  }

  async function initialize() {
    await window.biismoAuth.ready;
    client = window.biismoAuth.getClient?.();
    if (!client || !window.biismoAuth.getUser()) return;

    const decorateAll = () => grid.querySelectorAll(".garage-card").forEach(decorate);
    decorateAll();

    new MutationObserver(() => decorateAll()).observe(grid, { childList: true, subtree: true });

    // Re-check after the normal Garage renderer and after any upload completes.
    [500, 1500, 4000].forEach((delay) => window.setTimeout(() => {
      grid.querySelectorAll(".garage-card").forEach((card) => scheduleRefresh(card, 0));
    }, delay));

    grid.addEventListener("change", (event) => {
      const input = event.target.closest?.("[data-photo-input]");
      if (!input) return;
      const card = input.closest(".garage-card");
      if (!card) return;
      [1800, 5000, 10000].forEach((delay) => window.setTimeout(() => scheduleRefresh(card, 0), delay));
    });
  }

  initialize().catch(() => {});
})();
