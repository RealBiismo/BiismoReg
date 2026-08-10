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

  function hide(node, value) {
    if (node) node.hidden = Boolean(value);
  }

  function makeNav(staffRole) {
    if (byId("staffWorkspaceNav") || staffRole === "moderator") return;
    const hero = adminView.querySelector(".admin-hero");
    const nav = document.createElement("nav");
    nav.id = "staffWorkspaceNav";
    nav.className = "staff-workspace-nav";
    nav.setAttribute("aria-label", "Staff dashboard sections");
    const items = [
      ["overview", "Overview"],
      ["users", "Users"],
      ["notifications", "Notifications"],
    ];
    if (staffRole === "owner") items.push(["team", "Team"]);
    nav.innerHTML = items.map(([key, label], index) => `<button type="button" data-staff-section="${key}" class="${index === 0 ? "is-active" : ""}">${label}</button>`).join("");
    hero?.after(nav);
    nav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-staff-section]");
      if (!button) return;
      setSection(button.dataset.staffSection);
    });
  }

  function setSection(section) {
    const hero = adminView.querySelector(".admin-hero");
    const overview = adminView.querySelector(".admin-overview");
    const dashboardGrid = adminView.querySelector(".admin-dashboard-grid");
    const userPanel = adminView.querySelector(".admin-user-panel");
    const broadcastPanel = adminView.querySelector(".admin-broadcast-panel");
    const historyPanel = byId("adminBroadcastHistoryPanel");
    const quickTools = adminView.querySelector(".admin-quick-tools");
    const teamPanel = byId("teamManagementPanel");

    adminView.dataset.staffSection = section;
    hide(hero, section !== "overview");
    hide(overview, section !== "overview");
    hide(quickTools, section !== "overview");
    hide(userPanel, section !== "users");
    hide(broadcastPanel, section !== "notifications");
    hide(historyPanel, section !== "notifications" || historyPanel?.hidden);
    hide(teamPanel, section !== "team");

    if (dashboardGrid) {
      dashboardGrid.hidden = !["users", "notifications"].includes(section);
      dashboardGrid.classList.toggle("is-single-workspace", ["users", "notifications"].includes(section));
    }

    document.querySelectorAll("[data-staff-section]").forEach((button) => {
      const active = button.dataset.staffSection === section;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setupModeratorView() {
    document.body.classList.add("has-moderator-workspace");
    const hero = adminView.querySelector(".admin-hero");
    const overview = adminView.querySelector(".admin-overview");
    const broadcastPanel = adminView.querySelector(".admin-broadcast-panel");
    const historyPanel = byId("adminBroadcastHistoryPanel");
    const quickTools = adminView.querySelector(".admin-quick-tools");
    const teamPanel = byId("teamManagementPanel");
    const dashboardGrid = adminView.querySelector(".admin-dashboard-grid");
    const userPanel = adminView.querySelector(".admin-user-panel");
    const refresh = byId("adminDashboardRefreshButton");
    const heading = byId("adminUserSearchTitle");
    const rate = userPanel?.querySelector(".credit-rate");
    const eyebrow = userPanel?.querySelector(".admin-panel-heading .eyebrow");

    [hero, overview, broadcastPanel, historyPanel, quickTools, teamPanel, refresh].forEach((node) => hide(node, true));
    hide(userPanel, false);
    if (dashboardGrid) {
      dashboardGrid.hidden = false;
      dashboardGrid.classList.add("is-single-workspace", "is-moderator-workspace");
    }
    if (heading) heading.textContent = "Account support";
    if (eyebrow) eyebrow.textContent = "MODERATOR SUPPORT";
    if (rate) rate.textContent = "Read-only account tools";

    const banner = byId("staffRoleBanner");
    if (banner) {
      banner.innerHTML = "<strong>Moderator workspace</strong><span>Search accounts, review usage and add internal support notes. Admin-only controls are not shown.</span>";
    }

    const menu = byId("adminMenuButton");
    if (menu) menu.textContent = "Moderator";
  }

  async function init() {
    injectStyles();
    const staffRole = await waitForRole();
    if (!staffRole || staffRole === "user") return;

    if (staffRole === "moderator") {
      setupModeratorView();
      return;
    }

    document.body.classList.add("has-organised-admin");
    makeNav(staffRole);

    const teamObserver = new MutationObserver(() => {
      if (role() === "owner" && byId("teamManagementPanel")) {
        teamObserver.disconnect();
        if (adminView.dataset.staffSection !== "team") hide(byId("teamManagementPanel"), true);
      }
    });
    teamObserver.observe(adminView, { childList: true, subtree: true });

    setSection("overview");
  }

  void init();
})();
