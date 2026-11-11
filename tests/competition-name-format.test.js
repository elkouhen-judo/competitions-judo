const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Charge le bundle navigateur de app-ui dans un contexte minimal pour tester le formatage pur.
function loadKirokuUi() {
  const source = fs.readFileSync(path.join(__dirname, "..", "assets", "dist", "app-ui.js"), "utf8");
  const window = {};
  vm.runInNewContext(source, { window, document: {}, console });
  return window.KirokuUI;
}

test("les noms de compétition tout en capitales s'affichent en casse de titre française", () => {
  const { formatCompetitionName } = loadKirokuUi();
  assert.equal(formatCompetitionName("TOURNOI LABEL A CADET(TE) DE LAMBALLE"), "Tournoi Label A Cadet(te) de Lamballe");
  assert.equal(formatCompetitionName("TOURNOI LABEL A CADETS DE SAINT GREGOIRE"), "Tournoi Label A Cadets de Saint Gregoire");
  assert.equal(formatCompetitionName("OPEN DE SAINT-MALO"), "Open de Saint-Malo");
  assert.equal(formatCompetitionName("COUPE D’ILLE-ET-VILAINE"), "Coupe d’Ille-et-Vilaine");
  assert.equal(formatCompetitionName("L'OPEN DU MANS"), "L'Open du Mans");
  assert.equal(formatCompetitionName("tournoi de rennes"), "Tournoi de Rennes");
});

test("un nom déjà saisi en casse mixte est conservé tel quel", () => {
  const { formatCompetitionName } = loadKirokuUi();
  assert.equal(formatCompetitionName("Grand Prix des Jeunes de Craon"), "Grand Prix des Jeunes de Craon");
  assert.equal(formatCompetitionName("Open de printemps"), "Open de printemps");
  assert.equal(formatCompetitionName("  Tournoi   de  Rennes "), "Tournoi de Rennes");
  assert.equal(formatCompetitionName(""), "");
  assert.equal(formatCompetitionName(null), "");
});
