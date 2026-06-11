const createCompetitionsService = require("../core/services/competitions.service");
const createCombatsService = require("../core/services/combats.service");

module.exports = function createBusinessModule(deps) {
  const competitionsService = createCompetitionsService(deps);
  const combatsService = createCombatsService(deps);

  return {
    getCompetitionsForUser: competitionsService.getCompetitionsForUser,
    methods: {
      ...competitionsService.methods,
      ...combatsService.methods
    }
  };
};
