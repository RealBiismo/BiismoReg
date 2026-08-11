(() => {
  if (window.location.pathname !== '/ai-mechanic.html') return;

  const GENERIC_VEHICLE_ID = '00000000-0000-0000-0000-000000000000';

  function installStandaloneMode() {
    // ai-mechanic.js uses these global lexical bindings. Keep a harmless generic
    // vehicle entry so its existing send/busy logic works without Garage data.
    try {
      vehicles = [{ id: GENERIC_VEHICLE_ID, registration: 'BIISMO AI', make: '', model: '' }];
      selectedCategory = 'General vehicle question';
    } catch {}

    const vehicleSelect = document.getElementById('vehicleSelect');
    if (vehicleSelect) {
      vehicleSelect.innerHTML = `<option value="${GENERIC_VEHICLE_ID}" selected>Biismo AI</option>`;
      vehicleSelect.value = GENERIC_VEHICLE_ID;
      vehicleSelect.classList.add('ai-standalone-hidden');
    }

    const mobileVehicle = document.getElementById('mobileDraftVehicleSelect');
    if (mobileVehicle) {
      mobileVehicle.innerHTML = `<option value="${GENERIC_VEHICLE_ID}" selected>Biismo AI</option>`;
      mobileVehicle.value = GENERIC_VEHICLE_ID;
      mobileVehicle.classList.add('ai-standalone-hidden');
    }

    const category = document.querySelector('.ai-category-fieldset');
    category?.classList.add('ai-standalone-hidden');
    document.querySelector('label[for="vehicleSelect"]')?.classList.add('ai-standalone-hidden');

    const title = document.getElementById('chatTitle');
    const vehicle = document.getElementById('chatVehicle');
    if (document.body.classList.contains('ai-mobile-new-chat')) {
      if (vehicle) vehicle.textContent = 'BIISMO AI';
      if (title) title.textContent = 'New chat';
    }

    const remove = document.getElementById('removeAiChatButton');
    if (remove && !currentCaseId) remove.hidden = true;
  }

  // Replace the legacy Garage loader before the AI page initialiser needs it.
  try {
    loadVehicles = async function standaloneVehicleLoader() {
      vehicles = [{ id: GENERIC_VEHICLE_ID, registration: 'BIISMO AI', make: '', model: '' }];
      if (vehicleSelect) {
        vehicleSelect.innerHTML = `<option value="${GENERIC_VEHICLE_ID}" selected>Biismo AI</option>`;
        vehicleSelect.value = GENERIC_VEHICLE_ID;
      }
      if (startButton) startButton.disabled = requestInFlight || aiQuestions < 1;
    };
  } catch {}

  function syncChatHeader() {
    const title = document.getElementById('chatTitle');
    const vehicle = document.getElementById('chatVehicle');
    const remove = document.getElementById('removeAiChatButton');
    if (document.body.classList.contains('ai-mobile-new-chat') || !currentCaseId) {
      if (vehicle) vehicle.textContent = 'BIISMO AI';
      if (title && document.body.classList.contains('ai-mobile-new-chat')) title.textContent = 'New chat';
      if (remove) remove.hidden = true;
    } else if (remove) {
      remove.hidden = false;
    }
  }

  const observer = new MutationObserver(() => {
    installStandaloneMode();
    syncChatHeader();
  });

  function init() {
    installStandaloneMode();
    syncChatHeader();
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class','hidden'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
