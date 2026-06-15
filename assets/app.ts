(() => {
  const app = window.createKirokuApp();
  app.loginScreen.bindEvents();
  app.screens.competition.bindEvents();
  app.loginScreen.init();
})();
