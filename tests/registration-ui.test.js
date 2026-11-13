const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function loadKirokuUi() {
  const window = {};
  vm.runInNewContext(read("assets/dist/app-ui.js"), { window, document: {}, console });
  return window.KirokuUI;
}

test("INSCR-2 : la saison sportive va de septembre à août", () => {
  const { getSeasonStartYear, formatSeasonLabel } = loadKirokuUi();
  assert.equal(getSeasonStartYear("2026-08-31"), 2025);
  assert.equal(getSeasonStartYear("2026-09-01"), 2026);
  assert.equal(getSeasonStartYear(""), null);
  assert.equal(formatSeasonLabel(2026), "2026-2027");
});

test("INSCR-2 : un judoka non réinscrit ne peut pas être engagé dans la nouvelle saison", () => {
  const { isRegisteredForDate } = loadKirokuUi();
  const registered2025 = { profileType: "JUDOKA", registrationSeason: 2025 };
  assert.equal(isRegisteredForDate(registered2025, "2026-06-10"), true);
  assert.equal(isRegisteredForDate(registered2025, "2026-10-10"), false);
  assert.equal(isRegisteredForDate({ profileType: "JUDOKA", registrationSeason: null }, "2026-10-10"), false);
  // Saison inconnue côté client (donnée non chargée) ou profil parent : on ne bloque pas.
  assert.equal(isRegisteredForDate({ profileType: "JUDOKA" }, "2026-10-10"), true);
  assert.equal(isRegisteredForDate({ profileType: "PARENT", registrationSeason: null }, "2026-10-10"), true);
});

test("INSCR-2 : accueil, fiche et compétitions club signalent les non-réinscrits", () => {
  const home = read("assets/app-screen-home.ts");
  assert.match(home, /Non réinscrit pour la saison \$\{ui\.formatSeasonLabel\(season\)\}/);
  assert.match(home, /!homeRegistrationNotice\.value/);
  assert.match(home, /isRegisteredForDate\(judoka, ui\.getCurrentLocalDate\(\)\) \? "" : "Non réinscrit"/);
  assert.match(read("assets/views/home.html"), /id="homeRegistrationNotice"/);
  assert.match(read("assets/views/judoka.html"), /id="judokaHeroUnregistered"/);
  assert.match(read("assets/app-judoka-presentation.ts"), /"Non réinscrit"/);
  const club = read("assets/app-screen-club-competition.ts");
  assert.match(club, /p\.ageCategory === ageCategory && isOptionRegistered\(p\)/);
  assert.match(club, /ne sont pas réinscrits pour la saison/);
  assert.match(read("assets/views/club-competition-form.html"), /@input="updateClubCompetitionDate\(\)"/);
  assert.match(read("assets/views/club-competition-detail.html"), /id="clubDetailUnregistered"/);
});
