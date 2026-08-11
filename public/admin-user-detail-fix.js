(() => {
  if (window.location.pathname !== '/account.html') return;

  const byId = (id) => document.getElementById(id);
  let loadingEmail = '';
  let lastLoadedEmail = '';

  function formatJoined(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  function selectedEmail() {
    return String(byId('selectedUserEmail')?.textContent || '')
      .replace('♛', '')
      .trim()
      .toLowerCase();
  }

  function render(account) {
    const searches = byId('selectedUserSearches');
    const vehicles = byId('selectedUserVehicles');
    const joined = byId('selectedUserJoined');
    const credits = byId('selectedUserCredits');

    if (credits) credits.textContent = String(Number(account?.credits) || 0);
    if (searches) searches.textContent = String(Number(account?.searchesToday) || 0);
    if (vehicles) vehicles.textContent = String(Number(account?.savedVehicles) || 0);
    if (joined) joined.textContent = formatJoined(account?.joinedAt);
  }

  async function load(email) {
    if (!email.includes('@') || loadingEmail === email) return;
    loadingEmail = email;
    try {
      await window.biismoAuth.ready;
      const response = await window.biismoAuth.authorizedFetch('/api/admin/user-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const account = await response.json();
      if (!response.ok) throw new Error(account?.error || 'User details could not be loaded.');
      if (selectedEmail() !== email) return;
      render(account);
      lastLoadedEmail = email;
    } catch (error) {
      console.error('Selected account metrics failed to load:', error);
    } finally {
      if (loadingEmail === email) loadingEmail = '';
    }
  }

  function sync() {
    const email = selectedEmail();
    if (!email.includes('@')) return;
    if (email !== lastLoadedEmail) void load(email);
  }

  function init() {
    const emailNode = byId('selectedUserEmail');
    const result = byId('adminUserResult');
    if (!emailNode || !result) return;

    new MutationObserver(sync).observe(emailNode, {
      childList: true,
      subtree: true,
      characterData: true
    });
    new MutationObserver(sync).observe(result, {
      attributes: true,
      attributeFilter: ['hidden']
    });
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
