(() => {
  const result = document.getElementById("result");
  if (!result) return;

  const MIN_FONT_SIZE = 18;

  function fitTitle() {
    const title = result.querySelector(".vehicle-title-row .car-title, .car-title");
    if (!title) return;

    title.style.removeProperty("font-size");
    title.style.maxWidth = "100%";
    title.style.minWidth = "0";
    title.style.whiteSpace = "nowrap";

    const row = title.closest(".vehicle-title-row") || title.parentElement;
    if (!row) return;

    let size = Number.parseFloat(getComputedStyle(title).fontSize) || 36;
    const available = Math.max(row.clientWidth - (title.offsetLeft || 0), 0);

    while (size > MIN_FONT_SIZE && title.scrollWidth > available) {
      size -= 1;
      title.style.fontSize = `${size}px`;
    }

    if (title.scrollWidth > available) {
      title.style.fontSize = `${MIN_FONT_SIZE}px`;
    }
  }

  const observer = new MutationObserver(() => requestAnimationFrame(fitTitle));
  observer.observe(result, { childList: true, subtree: true, characterData: true });

  window.addEventListener("resize", () => requestAnimationFrame(fitTitle));
  document.fonts?.ready?.then(() => requestAnimationFrame(fitTitle));
  requestAnimationFrame(fitTitle);
})();
