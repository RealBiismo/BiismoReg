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
    if (!image || !placeholder || !url) return;

    image.src = url;
    image.hidden = false;
    placeholder.hidden = true;
  }

  function clearPreviousObjectUrl(card) {
    const previous = objectUrls.get(card);
    if (previous) {
      URL.revokeObjectURL(previous);
      objectUrls.delete(card);
    }
  }

  async function downloadPhoto(card, path) {
    const { data, error } = await client.storage.from("vehicle-photos").download(path);
    if (error || !data) return false;
    clearPreviousObjectUrl(card);
    const url = URL.createObjectURL(data);
    objectUrls.set(card, url);
    setPhoto(card, url);
    return true;
  }

  async function displayPhoto(card, path) {
    if (!path) return false;

    try {
      const { data, error } = await client.storage.from("vehicle-photos").createSignedUrl(path, 3600);
      const signedUrl = !error ? data?.signedUrl : null;
      if (signedUrl) {
        const image = card.querySelector("[data-vehicle-photo]");
        if (image) {
          image.onerror = async () => {
            image.onerror = null;
            await downloadPhoto(card, path);
          };
        }
        setPhoto(card, signedUrl);
        return true;
      }
    } catch {}

    return downloadPhoto(card, path);
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

  function scheduleRefresh(card, delay = 150) {
    const existing = refreshTimers.get(card);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      refreshTimers.delete(card);
      refreshCard(card);
    }, delay);
    refreshTimers.set(card, timer);
  }

  function decorate(card) {
    if (card.dataset.photoDisplayFixReady === "true") return;
    if (!card.querySelector("[data-vehicle-photo]")) return;
    card.dataset.photoDisplayFixReady = "true";
    scheduleRefresh(card, 0);

    const input = card.querySelector("[data-photo-input]");
    input?.addEventListener("change", () => {
      scheduleRefresh(card, 1500);
      scheduleRefresh(card, 5000);
      scheduleRefresh(card, 12000);
    });
  }

  async function initialize() {
    await window.biismoAuth.ready;
    client = window.biismoAuth.getClient?.();
    if (!client || !window.biismoAuth.getUser()) return;

    const decorateAll = () => grid.querySelectorAll(".garage-card").forEach(decorate);
    decorateAll();

    const observer = new MutationObserver((mutations) => {
      decorateAll();
      mutations.forEach((mutation) => {
        if (mutation.type !== "attributes" || mutation.attributeName !== "class") return;
        const card = mutation.target.closest?.(".garage-card") || mutation.target;
        if (card?.classList?.contains("garage-card") && !card.classList.contains("is-photo-uploading")) {
          scheduleRefresh(card, 250);
        }
      });
    });
    observer.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  initialize().catch(() => {});
})();
