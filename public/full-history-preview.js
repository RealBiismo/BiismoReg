(() => {
  const result = document.getElementById("result");
  if (!result) return;

  const FEATURES = [
    ["Write-off history", "Insurance category and recorded total-loss history"],
    ["Outstanding finance", "Check for recorded finance agreements"],
    ["Stolen status", "Check against recorded stolen vehicle data"],
    ["Previous keepers", "See the recorded number of former keepers"],
    ["Plate changes", "View recorded registration plate changes"],
    ["Mileage check", "Cross-check mileage records for inconsistencies"],
    ["Import / export", "See recorded import and export markers"],
    ["Vehicle valuation", "Estimated market valuation insights"],
  ];

  function buildPreview(registration) {
    const safeRegistration = String(registration || "this vehicle")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

    return `
      <section class="full-history-preview" aria-labelledby="fullHistoryPreviewTitle">
        <div class="full-history-preview__top">
          <div>
            <span class="full-history-preview__eyebrow">FULL VEHICLE HISTORY</span>
            <h3 id="fullHistoryPreviewTitle">Unlock the full story behind ${safeRegistration}</h3>
            <p>Extra provenance checks designed to help you spot costly surprises before buying.</p>
          </div>
          <div class="full-history-preview__price">
            <span>Planned price</span>
            <strong>£9.99</strong>
          </div>
        </div>

        <div class="full-history-preview__grid">
          ${FEATURES.map(([title, description]) => `
            <article class="full-history-preview__item">
              <span class="full-history-preview__lock" aria-hidden="true">🔒</span>
              <div>
                <strong>${title}</strong>
                <small>${description}</small>
              </div>
              <span class="full-history-preview__masked" aria-hidden="true">•••</span>
            </article>
          `).join("")}
        </div>

        <button class="full-history-preview__button" type="button" disabled aria-disabled="true">
          Coming soon — Full History £9.99
        </button>
        <p class="full-history-preview__note">Preview only. No payment is taken and no paid history check is currently performed.</p>
      </section>
    `;
  }

  function injectPreview() {
    const card = result.querySelector(".result-card:not(.error-state)");
    if (!card || card.querySelector(".full-history-preview")) return;

    const registration = card.querySelector(".result-reg")?.textContent?.trim();
    const actions = card.querySelector(".actions-row");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = buildPreview(registration);
    const preview = wrapper.firstElementChild;

    if (actions) actions.insertAdjacentElement("beforebegin", preview);
    else card.appendChild(preview);
  }

  const observer = new MutationObserver(injectPreview);
  observer.observe(result, { childList: true, subtree: true });
  injectPreview();
})();