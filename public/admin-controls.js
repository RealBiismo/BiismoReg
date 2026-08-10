(() => {
  const OWNER_ID = "00d08e31-69b7-48ff-b898-815da4b302e6";
  const OWNER_EMAIL = "cybzerohq@gmail.com";

  const crownSvg = `
    <span class="owner-crown" title="BIISMO REG owner" aria-label="BIISMO REG owner">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7Z"></path>
        <path d="M6 21h12"></path>
      </svg>
    </span>`;

  async function createAdminClient() {
    const response = await fetch("/api/config", { cache: "no-store" });
    const config = await response.json();
    if (!response.ok) throw new Error(config.error || "Account services are unavailable.");
    return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }

  function decorateOwnAccount(user) {
    const accountEmail = document.getElementById("accountEmail");
    if (!accountEmail || !user) return;
    const isOwner = user.id === OWNER_ID && String(user.email || "").toLowerCase() === OWNER_EMAIL;
    accountEmail.closest(".account-identity")?.querySelector(".owner-crown")?.remove();
    if (isOwner) accountEmail.insertAdjacentHTML("afterend", crownSvg);
  }

  function ensureAccessPanel() {
    const result = document.getElementById("adminUserResult");
    if (!result || document.getElementById("adminAccountAccess")) return;
    result.insertAdjacentHTML("beforeend", `
      <section id="adminAccountAccess" class="admin-account-access" aria-labelledby="adminAccountAccessTitle">
        <div>
          <span class="eyebrow">ACCOUNT ACCESS</span>
          <h3 id="adminAccountAccessTitle">User status</h3>
          <p id="selectedUserBanStatus">Search for an account to manage access.</p>
        </div>
        <button id="adminBanUserButton" class="danger-button" type="button" disabled>Ban account</button>
      </section>`);
  }

  function renderSelectedIdentity(account) {
    const emailNode = document.getElementById("selectedUserEmail");
    const statusNode = document.getElementById("selectedUserBanStatus");
    const button = document.getElementById("adminBanUserButton");
    if (!emailNode || !statusNode || !button) return;

    emailNode.textContent = account.email;
    if (account.isOwner) emailNode.insertAdjacentHTML("beforeend", crownSvg);

    if (account.isAdmin) {
      statusNode.textContent = "Protected admin account — access cannot be blocked.";
      statusNode.className = "is-protected";
      button.disabled = true;
      button.textContent = "Protected account";
      button.dataset.email = "";
      return;
    }

    const banned = Boolean(account.banned);
    statusNode.textContent = banned
      ? "This account is banned and its active sessions have been revoked."
      : "This account is active and can sign in normally.";
    statusNode.className = banned ? "is-banned" : "is-active";
    button.disabled = false;
    button.textContent = banned ? "Unban account" : "Ban account";
    button.dataset.email = account.email;
    button.dataset.banned = String(banned);
  }

  async function loadSelectedAccount(client, email) {
    const { data, error } = await client.rpc("admin_get_user_credits", { p_target_email: email });
    if (error) throw error;
    renderSelectedIdentity(data);
  }

  async function initialize() {
    ensureAccessPanel();
    const client = await createAdminClient();
    const { data } = await client.auth.getSession();
    decorateOwnAccount(data.session?.user || null);

    const selectedEmail = document.getElementById("selectedUserEmail");
    const result = document.getElementById("adminUserResult");
    const banButton = document.getElementById("adminBanUserButton");
    const adminStatus = document.getElementById("adminStatus");
    let lastEmail = "";

    const refreshFromSelection = async () => {
      if (!result || result.hidden) return;
      const email = String(selectedEmail?.textContent || "").replace(/\s+/g, "").toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email === lastEmail) return;
      lastEmail = email;
      try {
        await loadSelectedAccount(client, email);
      } catch (error) {
        if (adminStatus) adminStatus.textContent = error.message || "Account status could not be loaded.";
      }
    };

    const observer = new MutationObserver(refreshFromSelection);
    if (result) observer.observe(result, { subtree: true, childList: true, characterData: true, attributes: true });

    banButton?.addEventListener("click", async () => {
      const email = banButton.dataset.email;
      if (!email) return;
      const currentlyBanned = banButton.dataset.banned === "true";
      const nextBanned = !currentlyBanned;
      const action = nextBanned ? "ban" : "unban";
      if (!window.confirm(`${action === "ban" ? "Ban" : "Unban"} ${email}?${nextBanned ? " They will be signed out immediately." : ""}`)) return;

      banButton.disabled = true;
      if (adminStatus) adminStatus.textContent = `${action === "ban" ? "Banning" : "Unbanning"} ${email}…`;
      const { error } = await client.rpc("admin_set_user_ban", {
        p_target_email: email,
        p_banned: nextBanned,
      });
      if (error) {
        if (adminStatus) adminStatus.textContent = error.message || "Account access could not be changed.";
        banButton.disabled = false;
        return;
      }

      lastEmail = "";
      await loadSelectedAccount(client, email);
      if (adminStatus) {
        adminStatus.textContent = nextBanned
          ? `${email} has been banned and signed out.`
          : `${email} has been unbanned.`;
        adminStatus.className = "admin-status is-success";
      }
    });

    await refreshFromSelection();
  }

  window.addEventListener("DOMContentLoaded", () => {
    initialize().catch(() => {
      // The existing account and admin tools continue working if this enhancement cannot load.
    });
  });
})();
