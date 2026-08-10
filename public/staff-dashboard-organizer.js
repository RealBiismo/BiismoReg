(() => {
  if (window.location.pathname !== "/account.html") return;

  const byId = (id) => document.getElementById(id);
  const adminView = byId("adminView");
  if (!adminView) return;

  function injectStyles() {
    if (document.querySelector('link[href="/staff-dashboard-organizer.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/staff-dashboard-organizer.css";
    document.head.append(link);
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

  function hide(node, value = true) {
    if (node) node.hidden = Boolean(value);
  }

  function buildGlobalActions(staffRole) {
    if (staffRole === "moderator" || byId("staffGlobalActions")) return;
    const broadcast = adminView.querySelector(".admin-broadcast-panel");
    const history = byId("adminBroadcastHistoryPanel");
    if (!broadcast) return;

    hide(broadcast, true);
    hide(history, true);

    const bar = document.createElement("div");
    bar.id = "staffGlobalActions";
    bar.className = "staff-global-actions";
    bar.innerHTML = '<button id="staffBroadcastToggle" class="secondary-button compact-button" type="button" aria-expanded="false">Global actions</button>';

    const overview = adminView.querySelector(".admin-overview");
    overview?.after(bar);
    bar.after(broadcast);

    byId("staffBroadcastToggle")?.addEventListener("click", () => {
      const open = broadcast.hidden;
      hide(broadcast, !open);
      if (!open) hide(history, true);
      const button = byId("staffBroadcastToggle");
      if (button) {
        button.setAttribute("aria-expanded", String(open));
        button.textContent = open ? "Close global actions" : "Global actions";
      }
      if (open) broadcast.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function simplify(staffRole) {
    document.body.classList.add("has-user-focused-staff-dashboard");
    if (staffRole === "moderator") document.body.classList.add("has-moderator-workspace");

    const hero = adminView.querySelector(".admin-hero");
    const overview = adminView.querySelector(".admin-overview");
    const dashboardGrid = adminView.querySelector(".admin-dashboard-grid");
    const userPanel = adminView.querySelector(".admin-user-panel");
    const broadcast = adminView.querySelector(".admin-broadcast-panel");
    const history = byId("adminBroadcastHistoryPanel");
    const activity = adminView.querySelector(".admin-quick-tools");
    const teamPanel = byId("teamManagementPanel");
    const oldNav = byId("staffWorkspaceNav");
    const banner = byId("staffRoleBanner");

    hide(hero, true);
    hide(oldNav, true);
    hide(teamPanel, true);
    hide(history, true);
    hide(broadcast, true);
    hide(banner, true);

    hide(overview, false);
    hide(activity, false);
    hide(userPanel, false);
    hide(dashboardGrid, false);

    if (dashboardGrid) dashboardGrid.classList.add("is-user-focused-layout");

    if (overview && activity && overview.nextElementSibling !== activity) overview.after(activity);
    if (activity && dashboardGrid && activity.nextElementSibling !== dashboardGrid) activity.after(dashboardGrid);

    const result = byId("adminUserResult");
    if (result && !result.dataset.accountSelected) result.hidden = true;

    const menu = byId("adminMenuButton");
    if (menu) menu.textContent = staffRole === "moderator" ? "Moderator" : "Admin";

    buildGlobalActions(staffRole);
  }

  async function init() {
    injectStyles();
    const staffRole = await waitForRole();
    if (!staffRole || staffRole === "user") return;

    simplify(staffRole);

    const observer = new MutationObserver(() => {
      const teamPanel = byId("teamManagementPanel");
      if (teamPanel) hide(teamPanel, true);
      const banner = byId("staffRoleBanner");
      if (banner) hide(banner, true);
    });
    observer.observe(adminView, { childList: true, subtree: true });
  }

  void init();
})();
