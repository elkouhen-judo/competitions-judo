(() => {
  registerServiceWorker();
  const app = window.createKirokuApp();
  if (!app.loginScreen) {
    throw new Error("Écran de connexion non initialisé.");
  }
  app.loginScreen.bindEvents();
  app.screens.competition.bindEvents();
  app.loginScreen.init();
  bindPageMenus();

  // NAV-1 : les menus « ⋯ » (<details class="page-menu">) se ferment après un choix, au clic
  // à l'extérieur ou avec Échap.
  function bindPageMenus() {
    const closeMenus = (except?: Element | null) => {
      document.querySelectorAll("details.page-menu[open]").forEach((menu) => {
        if (menu !== except) menu.removeAttribute("open");
      });
    };
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const menu = target?.closest("details.page-menu") || null;
      if (menu && target?.closest(".page-menu-list button, .page-menu-list a")) {
        menu.removeAttribute("open");
        return;
      }
      closeMenus(menu);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenus();
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js").catch((error) => {
        console.warn("[Kiroku] Service worker non enregistré.", error);
      });
    });
  }
})();
