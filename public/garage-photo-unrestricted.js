(() => {
  const grid = document.getElementById("garageGrid");
  if (!grid) return;

  function apply(card) {
    const input = card.querySelector("[data-photo-input]");
    if (input) {
      input.accept = "image/*";
      input.removeAttribute("capture");
    }

    const placeholder = card.querySelector("[data-photo-placeholder]");
    if (placeholder) {
      const small = placeholder.querySelector("small");
      if (small) small.textContent = "Choose any photo from your device";
    }
  }

  const applyAll = () => grid.querySelectorAll(".garage-card").forEach(apply);
  applyAll();
  new MutationObserver(applyAll).observe(grid, { childList: true, subtree: true });
})();
