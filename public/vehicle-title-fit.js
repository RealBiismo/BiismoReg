(() => {
  const result = document.getElementById("result");
  if (!result) return;

  const MIN_FONT_SIZE = 16;

  function fitTitle() {
    const title = result.querySelector(".vehicle-title-row .car-title, .car-title");
    if (!title) return;

    const row = title.closest(".vehicle-title-row") || title.parentElement;
    if (!row) return;

    const logo = row.querySelector(".vehicle-brand-mark");
    const rowStyle = getComputedStyle(row);
    const gap = Number.parseFloat(rowStyle.columnGap || rowStyle.gap) || 0;
    const logoWidth = logo ? logo.getBoundingClientRect().width : 0;
    const available = Math.max(row.getBoundingClientRect().width - logoWidth - gap, 0);
    if (!available) return;

    title.style.setProperty("flex", "1 1 auto", "important");
    title.style.setProperty("min-width", "0", "important");
    title.style.setProperty("max-width", `${available}px`, "important");
    title.style.setProperty("white-space", "nowrap", "important");
    title.style.setProperty("overflow", "visible", "important");

    title.style.removeProperty("font-size");
    let size = Number.parseFloat(getComputedStyle(title).fontSize) || 36;

    const probe = document.createElement("span");
    const computed = getComputedStyle(title);
    probe.textContent = title.textContent || "";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.whiteSpace = "nowrap";
    probe.style.fontFamily = computed.fontFamily;
    probe.style.fontWeight = computed.fontWeight;
    probe.style.fontStyle = computed.fontStyle;
    probe.style.letterSpacing = computed.letterSpacing;
    probe.style.textTransform = computed.textTransform;
    document.body.appendChild(probe);

    while (size > MIN_FONT_SIZE) {
      probe.style.fontSize = `${size}px`;
      if (probe.getBoundingClientRect().width <= available) break;
      size -= 1;
    }

    probe.remove();
    title.style.setProperty("font-size", `${Math.max(size, MIN_FONT_SIZE)}px`, "important");
  }

  const scheduleFit = () => requestAnimationFrame(() => requestAnimationFrame(fitTitle));
  const observer = new MutationObserver(scheduleFit);
  observer.observe(result, { childList: true, subtree: true, characterData: true });

  window.addEventListener("resize", scheduleFit);
  window.addEventListener("orientationchange", scheduleFit);
  document.fonts?.ready?.then(scheduleFit);
  scheduleFit();
})();
