(() => {
  const app = window.createKirokuApp();
  if (!app.loginScreen) {
    throw new Error("Écran de connexion non initialisé.");
  }
  app.loginScreen.bindEvents();
  app.screens.competition.bindEvents();
  app.loginScreen.init();
})();
