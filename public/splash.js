(() => {
  const splash = document.getElementById("appSplash");
  if (!splash) return;

  const sessionKey = "biismo-splash-seen-v1";
  let alreadySeen = false;

  try {
    alreadySeen = window.sessionStorage.getItem(sessionKey) === "true";
    if (!alreadySeen) window.sessionStorage.setItem(sessionKey, "true");
  } catch {
    // The intro still works when browser storage is unavailable.
  }

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

// Keep vehicle result styling isolated from the homepage layout rules.
if (window.location.pathname === "/" || window.location.pathname === "/index.html") {
  const resultStyles = document.createElement("link");
  resultStyles.rel = "stylesheet";
  resultStyles.href = "/result-compact.css";
  document.head.append(resultStyles);
}

// Staff enhancements are isolated from the core garage/admin code.
if (window.location.pathname === "/account.html") {
  import("/moderator-controls.js")
    .then(() => import("/staff-user-directory.js"))
    .then(() => import("/staff-dashboard-organizer.js"))
    .catch(() => {});
}
