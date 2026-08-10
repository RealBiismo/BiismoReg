(() => {
  if (window.location.pathname !== "/account.html") return;

  const byId = (id) => document.getElementById(id);
  let clientPromise = null;
  let accounts = [];

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        await window.biismoAuth.ready;
        const response = await fetch("/api/config", { cache: "no-store" });
        const config = await response.json();
        if (!response.ok) throw new Error(config.error || "Staff directory unavailable.");
        const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!data.session) throw new Error("Sign in again to view accounts.");
        return client;
      })();
    }
    return clientPromise;
  }

  async function rpc(name, params = {}) {
    const client = await getClient();
    const { data, error } = await client.rpc(name, params);
    if (error) throw new Error(error.message || "Staff directory unavailable.");
    return data;
  }

  function role() {
    return document.body.dataset.staffRole || "";
  }

  function waitForRole() {
    return new Promise((resolve) => {
      if (role()) return resolve(role());
      const observer = new MutationObserver(() => {
        if (!role()) return;
        observer.disconnect();
        resolve(role());
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ["data-staff-role"] });
      window.setTimeout(() => {
        observer.disconnect();
        resolve(role() || "user");
      }, 5000);
    });
  }

  function injectStylesheet() {
    if (document.querySelector('link[href="/staff-user-directory.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/staff-user-directory.css";
    document.head.append(link);
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function renderDirectory(filter = "") {
    const list = byId("staffUserDirectoryList");
    const count = byId("staffUserDirectoryCount");
    if (!list) return;
    const needle = String(filter || "").trim().toLowerCase();
    const filtered = accounts.filter((item) => !needle || String(item.email || "").includes(needle));
    if (count) count.textContent = `${filtered.length} of ${accounts.length} accounts`;
    list.innerHTML = filtered.length
      ? filtered.map((item) => `
        <button class="staff-user-row" type="button" data-user-email="${escapeHtml(item.email)}">
          <span class="staff-user-main">
            <strong>${escapeHtml(item.email)}</strong>
            <small>${escapeHtml(item.role)} · ${item.verified ? "Verified" : "Unverified"}${item.banned ? " · Banned" : ""}</small>
          </span>
          <span class="staff-user-meta">
            <span>${Number(item.credits) || 0} credits</span>
            <span>${Number(item.total_searches) || 0} searches</span>
            <span>Joined ${escapeHtml(formatDate(item.created_at))}</span>
          </span>
          <span class="staff-user-chevron" aria-hidden="true">›</span>
        </button>`).join("")
      : '<p class="notification-empty">No matching accounts.</p>';
  }

  function selectAccount(email) {
    const input = byId("adminUserEmail");
    const form = byId("adminUserSearchForm");
    if (!input || !form) return;
    input.value = email;
    form.requestSubmit();
    document.querySelectorAll(".staff-user-row").forEach((row) => {
      row.classList.toggle("is-selected", row.dataset.userEmail === email);
    });
  }

  function buildDirectory() {
    const panel = document.querySelector(".admin-user-panel");
    const form = byId("adminUserSearchForm");
    const result = byId("adminUserResult");
    if (!panel || !form || byId("staffUserDirectory")) return;

    const heading = panel.querySelector(".admin-panel-heading");
    if (heading) {
      const eyebrow = heading.querySelector(".eyebrow");
      const title = heading.querySelector("h2");
      const rate = heading.querySelector(".credit-rate");
      if (eyebrow) eyebrow.textContent = "ACCOUNTS";
      if (title) title.textContent = "All users";
      if (rate) rate.textContent = "Select an account to manage";
    }

    form.hidden = true;
    const status = byId("adminStatus");
    if (status) status.hidden = true;

    const directory = document.createElement("section");
    directory.id = "staffUserDirectory";
    directory.className = "staff-user-directory";
    directory.innerHTML = `
      <div class="staff-user-directory-toolbar">
        <label class="sr-only" for="staffUserDirectoryFilter">Filter accounts by email</label>
        <input id="staffUserDirectoryFilter" type="search" placeholder="Filter users by email…" autocomplete="off">
        <span id="staffUserDirectoryCount">Loading accounts…</span>
      </div>
      <div id="staffUserDirectoryList" class="staff-user-directory-list"><p class="notification-empty">Loading accounts…</p></div>`;

    if (result) panel.insertBefore(directory, result);
    else panel.append(directory);

    byId("staffUserDirectoryFilter")?.addEventListener("input", (event) => renderDirectory(event.target.value));
    byId("staffUserDirectoryList")?.addEventListener("click", (event) => {
      const row = event.target.closest("[data-user-email]");
      if (!row) return;
      selectAccount(row.dataset.userEmail);
    });
  }

  async function loadAccounts() {
    const list = byId("staffUserDirectoryList");
    try {
      const data = await rpc("staff_list_accounts");
      accounts = Array.isArray(data?.accounts) ? data.accounts : [];
      renderDirectory(byId("staffUserDirectoryFilter")?.value || "");
    } catch (error) {
      if (list) list.innerHTML = `<p class="notification-empty">${escapeHtml(error.message)}</p>`;
    }
  }

  async function init() {
    const staffRole = await waitForRole();
    if (!staffRole || staffRole === "user") return;
    injectStylesheet();
    buildDirectory();
    await loadAccounts();
  }

  void init();
})();
