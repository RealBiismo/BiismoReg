(() => {
  const nativeGetById = Document.prototype.getElementById;
  const aliases = {
    garageGrid: 'savedVehicles',
    vehicleCount: 'savedVehicleCount',
    reminderToggleButton: 'enableNotificationsButton',
    adminStatus: 'adminUserStatus'
  };

  Document.prototype.getElementById = function patchedGetElementById(id) {
    const direct = nativeGetById.call(this, id);
    if (direct) return direct;
    const alias = aliases[id];
    if (alias) return nativeGetById.call(this, alias);
    if (id === 'adminUserSearchButton') {
      return this.querySelector('#adminUserSearchForm button[type="submit"]');
    }
    if (id === 'garageStatus') {
      let status = nativeGetById.call(this, 'garageStatusCompat');
      if (!status) {
        status = this.createElement('p');
        status.id = 'garageStatusCompat';
        status.className = 'garage-status';
        const section = nativeGetById.call(this, 'savedVehicles')?.parentElement;
        if (section) section.insertBefore(status, nativeGetById.call(this, 'savedVehicles'));
      }
      return status;
    }
    return null;
  };

  const dismissOverlay = () => {
    const overlay = nativeGetById.call(document, 'loadingOverlay');
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 250);
  };

  window.setTimeout(() => {
    const overlay = nativeGetById.call(document, 'loadingOverlay');
    if (overlay?.classList.contains('is-visible')) dismissOverlay();
  }, 6500);

  window.addEventListener('error', (event) => {
    if (event?.filename?.includes('/account.js')) dismissOverlay();
  });
  window.addEventListener('unhandledrejection', dismissOverlay);
})();
