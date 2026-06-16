(() => {
  registerServiceWorker();
  const app = window.createKirokuApp();
  if (!app.loginScreen) {
    throw new Error("Écran de connexion non initialisé.");
  }
  app.loginScreen.bindEvents();
  app.screens.competition.bindEvents();
  app.loginScreen.init();

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
