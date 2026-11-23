const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { parseLiguePage } = require("../core/domain/ffjudo/ligue-page-parser");

const fixturesDir = path.join(__dirname, "fixtures", "ffjudo");
const ligueHost = "pays-de-la-loire-judo.ffjudo.com";
const ligueHtml = fs.readFileSync(path.join(fixturesDir, "ligue-pays-de-la-loire.html"), "utf8");

test("ligue page: parses every event of the embedded JSON", () => {
  assert.equal(parseLiguePage(ligueHtml, ligueHost).length, 15);
});

test("ligue page: builds federal and local keys", () => {
  const events = parseLiguePage(ligueHtml, ligueHost);
  assert.ok(events.some((event) => event.eventKey === "fed:1143"));
  assert.ok(events.some((event) => event.eventKey === `loc:${ligueHost}:2732`));
});

test("ligue page: converts unix timestamps (UTC midnight) to calendar dates", () => {
  const federal = parseLiguePage(ligueHtml, ligueHost).find(
    (event) => event.eventKey === "fed:1143"
  );
  assert.equal(federal.dateDebut, "2026-11-22");
  assert.equal(federal.inscriptionCloture, "2026-11-17");
  const local = parseLiguePage(ligueHtml, ligueHost).find(
    (event) => event.eventKey === `loc:${ligueHost}:2732`
  );
  assert.equal(local.dateDebut, "2025-01-19");
  assert.equal(local.inscriptionCloture, "");
});

test("ligue page: maps the useful fields and keeps the source host", () => {
  const federal = parseLiguePage(ligueHtml, ligueHost).find(
    (event) => event.eventKey === "fed:1143"
  );
  assert.equal(federal.titre, "(38) TOURNOI EXCELLENCE VETERANS D ALPES JUDO FONTAINE");
  assert.equal(federal.typeEvenement, "COMPETITION");
  assert.equal(federal.lieu, "GYMNASE ARISTIDE BERGES");
  assert.equal(federal.ville, "SEYSSINET PARISET");
  assert.equal(federal.codePostal, "38170");
  assert.equal(federal.proprietaire, "Ligue AUVERGNE-RHONE-ALPES JUDO");
  assert.deepEqual(federal.sources, [ligueHost]);
});

test("ligue page: builds source url from slug and site id", () => {
  const federal = parseLiguePage(ligueHtml, ligueHost).find(
    (event) => event.eventKey === "fed:1143"
  );
  assert.equal(
    federal.sourceUrl,
    `https://${ligueHost}/evenement/38-tournoi-excellence-veterans-d-alpes-judo-fontaine/15`
  );
});

test("ligue page: parses JSON containing apostrophes", () => {
  const titles = parseLiguePage(ligueHtml, ligueHost).map((event) => event.titre);
  assert.ok(titles.includes("Open de Côte d'Or benjamins à Beaune"));
});

test("ligue page: never exposes contacts", () => {
  const serialized = JSON.stringify(parseLiguePage(ligueHtml, ligueHost));
  assert.doesNotMatch(serialized, /Contact Fictif|0600000000|example\.invalid|contact/i);
});

const { parseNationalPage } = require("../core/domain/ffjudo/national-page-parser");

const nationalHtml = fs.readFileSync(path.join(fixturesDir, "national-page-1.html"), "utf8");

test("national page: parses national cards", () => {
  const { events } = parseNationalPage(nationalHtml);
  assert.equal(events.length, 25);
  const first = events[0];
  assert.equal(first.titre, "TOURNOI 2ÈME DIVISION CADETS JEAN-CLAUDE JEHIN (HDF)");
  assert.equal(first.lieu, "TERGNIER");
  assert.equal(first.dateDebut, "2026-11-28");
  assert.match(
    first.sourceUrl,
    /^https:\/\/www\.ffjudo\.com\/evenement\/tournoi-2eme-division-cadets-/
  );
});

test("national page: reads last page", () => {
  assert.equal(parseNationalPage(nationalHtml).lastPage, 4);
});

test("national page: parses start and end dates", () => {
  const stage = parseNationalPage(nationalHtml).events.find((event) =>
    event.sourceUrl.endsWith("/stage-national-fictif")
  );
  assert.equal(stage.dateDebut, "2026-12-27");
  assert.equal(stage.dateFin, "2026-12-29");
  assert.equal(stage.titre, "STAGE NATIONAL D'HIVER & KATA");
});

test("national page: builds national key and empty owner", () => {
  const stage = parseNationalPage(nationalHtml).events.find((event) =>
    event.sourceUrl.endsWith("/stage-national-fictif")
  );
  assert.equal(stage.eventKey, "nat:stage-national-fictif:2026-12-27");
  assert.equal(stage.proprietaire, "");
  assert.equal(stage.typeEvenement, "");
  assert.deepEqual(stage.sources, ["www.ffjudo.com"]);
});

test("national page: a page without cards nor pagination is an empty last page", () => {
  assert.deepEqual(parseNationalPage("<html><body></body></html>"), { events: [], lastPage: 1 });
});

const { resolveLigue, LIGUES, NATIONAL_LIGUE } = require("../core/domain/ffjudo/ligues");

test("ligues: resolves ligue owners", () => {
  assert.equal(resolveLigue("Ligue PAYS-DE-LA-LOIRE JUDO", ligueHost), "Pays de la Loire");
  assert.equal(resolveLigue("Ligue AUVERGNE-RHONE-ALPES JUDO", ligueHost), "Auvergne-Rhône-Alpes");
  assert.equal(resolveLigue("Ligue PACA JUDO", ligueHost), "Provence-Alpes-Côte d'Azur");
  assert.equal(resolveLigue("Ligue REUNION JUDO", ligueHost), "Réunion");
});

test("ligues: resolves committees, including truncated labels", () => {
  assert.equal(resolveLigue("Comité VENDEE JUDO", ligueHost), "Pays de la Loire");
  assert.equal(resolveLigue("Comité LOIRE ATLANTIQUE JUD", ligueHost), "Pays de la Loire");
  assert.equal(resolveLigue("Comité LOIRE JUDO", ligueHost), "Auvergne-Rhône-Alpes");
  assert.equal(resolveLigue("Comité DEUX SEVRES JUDO", ligueHost), "Nouvelle-Aquitaine");
  assert.equal(resolveLigue("Comité COTES D ARMOR JUDO", ligueHost), "Bretagne");
  assert.equal(
    resolveLigue("Comité BOUCHES DU RHONE JUD", ligueHost),
    "Provence-Alpes-Côte d'Azur"
  );
  assert.equal(resolveLigue("Comité CHARENTE MARITIME JU", ligueHost), "Nouvelle-Aquitaine");
  assert.equal(resolveLigue("Comité HTE GARONNE JUDO", ligueHost), "Occitanie");
  assert.equal(resolveLigue("Comité PYRENEES ATLANT. JUD", ligueHost), "Nouvelle-Aquitaine");
  assert.equal(resolveLigue("Comité DROME-ARDECHE JUDO", ligueHost), "Auvergne-Rhône-Alpes");
  assert.equal(
    resolveLigue("Comité TERRITOIRE BELFORT JUDO", ligueHost),
    "Bourgogne-Franche-Comté"
  );
  assert.equal(resolveLigue("Comité MAYOTTE", ligueHost), "Mayotte");
});

test("ligues: national owners and site-owned events", () => {
  assert.equal(resolveLigue("", "www.ffjudo.com"), NATIONAL_LIGUE);
  assert.equal(resolveLigue("FFJDA", ligueHost), NATIONAL_LIGUE);
  assert.equal(resolveLigue("Ligue FEDERATION FRANCAISE - AUTRES", ligueHost), NATIONAL_LIGUE);
  assert.equal(resolveLigue("", "judo-bretagne.ffjudo.com"), "Bretagne");
  assert.equal(resolveLigue("", "nouvelle-aquitaine-judo.ffjudo.com"), "Nouvelle-Aquitaine");
});

test("ligues: unknown owner resolves to empty", () => {
  assert.equal(resolveLigue("Comité INCONNU JUDO", ligueHost), "");
  assert.equal(resolveLigue("", "inconnu.ffjudo.com"), "");
});

test("ligues: every owner seen on the synchronized sites resolves to a listed ligue", () => {
  const owners = [
    "Comité AISNE JUDO",
    "Comité ALLIER JUDO",
    "Comité BAS RHIN JUDO",
    "Comité CHARENTE JUDO",
    "Comité CORREZE JUDO",
    "Comité COTE D OR JUDO",
    "Comité CREUSE JUDO",
    "Comité DORDOGNE JUDO",
    "Comité DOUBS JUDO",
    "Comité EURE ET LOIR JUDO",
    "Comité FINISTERE JUDO",
    "Comité GARD JUDO",
    "Comité GIRONDE JUDO",
    "Comité HTE SAONE JUDO",
    "Comité HTE VIENNE JUDO",
    "Comité ILLE ET VILAINE JUDO",
    "Comité LANDES JUDO",
    "Comité LOIRET JUDO",
    "Comité LOT ET GARONNE JUDO",
    "Comité LOT JUDO",
    "Comité MAINE ET LOIRE JUDO",
    "Comité MARNE JUDO",
    "Comité MAYENNE JUDO",
    "Comité MORBIHAN JUDO",
    "Comité NIEVRE JUDO",
    "Comité NORD JUDO",
    "Comité ORNE JUDO",
    "Comité PAS DE CALAIS JUDO",
    "Comité SARTHE JUDO",
    "Comité SEINE ET MARNE JUDO",
    "Comité SEINE MARITIME JUDO",
    "Comité TARN ET GARONNE JUDO",
    "Comité VIENNE JUDO",
    "Ligue BOURGOGNE-FRANCHE-COMTE JUDO",
    "Ligue BRETAGNE JUDO",
    "Ligue CORSE JUDO",
    "Ligue GRAND-EST JUDO",
    "Ligue GUYANE JUDO",
    "Ligue HAUTS-DE-FRANCE JUDO",
    "Ligue NORMANDIE JUDO",
    "Ligue NOUVELLE AQUITAINE JUDO",
    "Ligue OCCITANIE JUDO"
  ];
  for (const owner of owners) {
    assert.ok(LIGUES.includes(resolveLigue(owner, ligueHost)), owner);
  }
  assert.equal(resolveLigue("Comité VIENNE JUDO", ligueHost), "Nouvelle-Aquitaine");
  assert.equal(resolveLigue("Comité HTE VIENNE JUDO", ligueHost), "Nouvelle-Aquitaine");
  assert.equal(resolveLigue("Comité LOT JUDO", ligueHost), "Occitanie");
  assert.equal(resolveLigue("Comité LOT ET GARONNE JUDO", ligueHost), "Nouvelle-Aquitaine");
});

test("review #2: national page reads the real finish date of multi-day events", () => {
  const championnat = parseNationalPage(nationalHtml).events.find((event) =>
    event.sourceUrl.endsWith("/championnat-de-france-individuel-1ere-division-2")
  );
  assert.equal(championnat.dateDebut, "2026-11-28");
  assert.equal(championnat.dateFin, "2026-11-29");
});

test("review #1: a ligue page without the embedded calendar is not recognised", () => {
  assert.throws(() => parseLiguePage("<html></html>", ligueHost), /Gabarit FFJDA non reconnu/);
  const renamed = ligueHtml.replace('name="evenements"', 'name="evts"');
  assert.throws(() => parseLiguePage(renamed, ligueHost), /Gabarit FFJDA non reconnu/);
  const broken = ligueHtml.replace("value='{\"", "value='{x");
  assert.throws(() => parseLiguePage(broken, ligueHost), /Gabarit FFJDA non reconnu/);
});

test("review #1: a national page with pagination but no card is not recognised", () => {
  const renamed = nationalHtml.replaceAll('class="card_evenement"', 'class="carte"');
  assert.throws(() => parseNationalPage(renamed), /Gabarit FFJDA non reconnu/);
});

const { detectUvs } = require("../core/domain/ffjudo/uv");

test("uv: detects the UVs of real FFJDA grade session titles", () => {
  const grade = "PASSAGE DE GRADE";
  const cases = [
    ["Examen UV1/2/3b n°1", ["UV1", "UV2", "UV3"]],
    ["PASSAGE DE GRADE 1ER & 2ÈME DAN UV1-UV2", ["UV1", "UV2"]],
    ["PASSAGE DE GRADE BFC UV1 UV2 UV3-B", ["UV1", "UV2", "UV3"]],
    ["CD29 - Examen UV2 + VOLET B UV3", ["UV2", "UV3"]],
    ["TEC - UV 3", ["UV3"]],
    ["TEST EFFICACITE COMBAT DU 1ER AU 4EME DAN", ["UV3"]],
    ["SHIAI 1D 2D 3D BAR SUR AUBE", ["UV3"]],
    ["CD 22 : EXAMEN UV4", ["UV4"]],
    ["ENGAGEMENT PERSONNEL UV 4 JUJITSU", ["UV4"]],
    [
      "(OCC) PASSAGE DE GRADE - TOULOUSE - UV3 1D, 2D & 3D ET UV4 3D & 4D + PARA JUDO",
      ["UV3", "UV4"]
    ],
    ["PASSAGE GRADES UV1 1er,2ième,3ième & 4ième DAN", ["UV1"]],
    ["Examen UV1 /UV2 JUDO 1er & 2ème Dan", ["UV1", "UV2"]],
    ["PASSAGE DE GRADE N AQUITAINE JURANCON UV 3", ["UV3"]],
    ["Validation UV4 pour 1er à 4eme dan", ["UV4"]]
  ];
  for (const [titre, expected] of cases) {
    assert.deepEqual(detectUvs(titre, grade), expected, titre);
  }
});

test("uv: preparation stages, bare grade sessions and other events have no UV", () => {
  assert.deepEqual(detectUvs("CD 22 Stage UV2 n°1Cotes d’Armor", "PASSAGE DE GRADE"), []);
  assert.deepEqual(detectUvs("PASSAGE DE GRADE", "PASSAGE DE GRADE"), []);
  assert.deepEqual(detectUvs("CD56 STAGE JUJITSU TECHNIQUE ET FORMATION ARBITRAGE", "STAGE"), []);
  assert.deepEqual(
    detectUvs("TOURNOI EXCELLENCE CADETS / CADETTES DE NANTES 2026", "COMPETITION"),
    []
  );
  assert.deepEqual(detectUvs("COUPE TECHNIQUE REGIONALE", "COMPETITION"), []);
  assert.deepEqual(detectUvs("Rencontre ceintures noires UV3 1er dan", "COMPETITION"), ["UV3"]);
});

const { detectGrades } = require("../core/domain/ffjudo/grade");

test("AGD-015 : grade read in real FFJDA grade session titles", () => {
  const uvs = ["UV1"];
  const cases = [
    ["PASSAGE DE GRADE 1ER & 2ÈME DAN UV1-UV2", [1, 2]],
    ["TEST EFFICACITE COMBAT DU 1ER AU 4EME DAN", [1, 2, 3, 4]],
    ["Validation UV4 pour 1er à 4eme dan", [1, 2, 3, 4]],
    ["SHIAI 1D 2D 3D BAR SUR AUBE", [1, 2, 3]],
    ["(OCC) PASSAGE DE GRADE - TOULOUSE - UV3 1D, 2D & 3D ET UV4 3D & 4D + PARA JUDO", [1, 2, 3, 4]],
    ["PASSAGE GRADES UV1 1er,2ième,3ième & 4ième DAN", [1, 2, 3, 4]],
    ["Examen UV1 /UV2 JUDO 1er & 2ème Dan", [1, 2]],
    ["Kata shodan UV1", [1]],
    ["Rencontre ceintures noires UV3 1er dan", [1]]
  ];
  for (const [titre, expected] of cases) {
    assert.deepEqual(detectGrades(titre, uvs), expected, titre);
  }
});

test("AGD-015 : no grade without a recognizable one, above 6th dan, or without UV", () => {
  assert.deepEqual(detectGrades("Examen UV1/2/3b n°1", ["UV1"]), []);
  assert.deepEqual(detectGrades("CD 22 : EXAMEN UV4", ["UV4"]), []);
  assert.deepEqual(detectGrades("UV4 7EME DAN", ["UV4"]), []);
  assert.deepEqual(detectGrades("STAGE PREPARATION 1ER DAN", []), []);
});
