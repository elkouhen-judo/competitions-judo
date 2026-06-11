const { randomUUID } = require("node:crypto");

function buildJudokaId() {
  return `JUDO${randomUUID().replace(/-/g, "")}`;
}

function buildCompetitionId() {
  return `COMP${Date.now()}`;
}

function buildCombatId() {
  return `CB${Date.now()}`;
}

module.exports = {
  buildCombatId,
  buildCompetitionId,
  buildJudokaId
};
