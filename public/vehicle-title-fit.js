(() => {
  const result = document.getElementById("result");
  if (!result) return;

  const style = document.createElement("style");
  style.textContent = `
    #result .vehicle-title-row .car-title {
      min-width: 0 !important;
      max-width: 100% !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: clip !important;
    }
    #result .vehicle-title-row .car-title.is-long-title {
      font-size: 26px !important;
    }
    #result .vehicle-title-row .car-title.is-very-long-title {
      font-size: 22px !important;
      letter-spacing: -0.025em !important;
    }
    @media (max-width: 640px) {
      #result .vehicle-title-row .car-title.is-long-title {
        font-size: 22px !important;
      }
      #result .vehicle-title-row .car-title.is-very-long-title {
        font-size: 18px !important;
        letter-spacing: -0.03em !important;
      }
    }
  `;
  document.head.appendChild(style);

  function applyTitleSize() {
    const title = result.querySelector(".vehicle-title-row .car-title, .car-title");
    if (!title) return;

    const text = String(title.textContent || "").trim();
    title.classList.remove("is-long-title", "is-very-long-title");

    if (text.length >= 19) {
      title.classList.add("is-very-long-title");
    } else if (text.length >= 15) {
      title.classList.add("is-long-title");
    }
  }

  const schedule = () => requestAnimationFrame(() => requestAnimationFrame(applyTitleSize));
  const observer = new MutationObserver(schedule);
  observer.observe(result, { childList: true, subtree: true, characterData: true });

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  document.fonts?.ready?.then(schedule);
  schedule();
})();
