// GAT-010 : la gate refuse les données personnelles et laisse passer les données fictives.
// Les valeurs « réelles » sont assemblées à l'exécution pour ne pas être détectées dans ce fichier.
const test = require("node:test");
const assert = require("node:assert/strict");
const { findPersonalData } = require("../scripts/check-personal-data.js");

const kinds = (text, denylist) => findPersonalData(text, denylist).map((finding) => finding.kind);

test("GAT-010 : une adresse e-mail réelle est refusée, une adresse fictive acceptée", () => {
  assert.deepEqual(kinds(`email: "jean.dupont@${"gmail"}.com"`), ["e-mail"]);
  assert.deepEqual(
    kinds('email: "sam@example.com", "x@example.invalid", "noreply@anthropic.com"'),
    []
  );
});

test("GAT-010 : un identifiant réel de la base est refusé", () => {
  assert.deepEqual(kinds(`id: "JUDO${"0123456789abcdef".repeat(2)}"`), ["identifiant de la base"]);
  assert.deepEqual(kinds('id: "j-sam", "club-nantes"'), []);
});

test("GAT-010 : un numéro de mobile est refusé, sauf un numéro de démonstration", () => {
  assert.deepEqual(kinds(`tel: "06 12 34 56 ${"78"}"`), ["téléphone"]);
  assert.deepEqual(kinds('tel: "0600000000", date: "20260612000000"'), []);
});

test("GAT-010 : un nom de la liste locale est refusé, sans tenir compte des accents ni de la casse", () => {
  const denylist = ["Zoé Imaginaire"];
  assert.deepEqual(kinds('const name = "zoe imaginaire";', denylist), ["nom réel (liste locale)"]);
  assert.deepEqual(kinds('const name = "Zoé Test";', denylist), []);
});
