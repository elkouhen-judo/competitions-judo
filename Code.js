const SPREADSHEET_ID = "1oip8-lGjsg7iQO1SLHI-Z65fMicvUkyL_Iwg-6FjV7Q";

const SHEET_JUDOKAS = "Judokas";
const SHEET_COMPETITIONS = "Competitions";
const SHEET_COMBATS = "Combats";

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Suivi compétitions judo")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getCurrentUser() {
  return getCurrentUserContext().user;
}

function getCurrentUserContext() {
  const email = Session.getActiveUser().getEmail();

  if (!email) {
    throw new Error("Utilisateur non identifié.");
  }

  const judokas = getRowsAsObjects(SHEET_JUDOKAS);

  const user = judokas.find(j =>
    String(j.email || "").toLowerCase().trim() === String(email).toLowerCase().trim()
  );

  if (!user) {
    throw new Error("Accès refusé pour : " + email);
  }

  return {
    user,
    judokas
  };
}

function isAdmin(user) {
  return String(user.role || "").toUpperCase().trim() === "ADMIN";
}

function canManageCompetition(user, competition) {
  if (isAdmin(user)) {
    return true;
  }

  return String(competition.id_judoka) === String(user.id_judoka);
}

function resolveCompetitionOwnerId(user, competition) {
  const ownerJudokaId = isAdmin(user)
    ? competition.id_judoka
    : user.id_judoka;

  if (!ownerJudokaId) {
    throw new Error("Judoka propriétaire obligatoire.");
  }

  return ownerJudokaId;
}

function getInitialData() {

  try {

    const userContext = getCurrentUserContext();
    const user = userContext.user;
    const admin = isAdmin(user);

    const result = {
      user: user,
      isAdmin: admin,
      competitions: getCompetitionsForUser(user),
      judokas: admin ? userContext.judokas : []
    };

    return result;

  } catch(e) {

    return {
      error: e.message
    };
  }
}

function testInitialData() {
  const data = getInitialData();
  console.log(JSON.stringify(data, null, 2));
}

function getCompetitions() {
  const competitions = getRowsAsObjects(SHEET_COMPETITIONS)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return competitions;
}

function getCompetitionsForUser(user) {
  const competitions = getCompetitions();

  if (isAdmin(user)) {
    return competitions;
  }

  return competitions.filter(c => canManageCompetition(user, c));
}

function getCompetitionDetail(id_competition) {
  const userContext = getCurrentUserContext();
  const user = userContext.user;
  const admin = isAdmin(user);

  const competitions = getRowsAsObjects(SHEET_COMPETITIONS);
  const competition = competitions.find(c =>
    String(c.id_competition) === String(id_competition)
  );

  if (!competition) {
    throw new Error("Compétition introuvable.");
  }

  if (!canManageCompetition(user, competition)) {
    throw new Error("Accès refusé à cette compétition.");
  }

  const combats = getRowsAsObjects(SHEET_COMBATS);

  let filtered = combats.filter(c =>
    String(c.id_competition) === String(id_competition)
  );

  if (!admin) {
    filtered = filtered.filter(c =>
      String(c.id_judoka) === String(user.id_judoka)
    );

  }

  const judokas = admin ? userContext.judokas : [];
  const judokasById = admin
    ? new Map(judokas.map(j => [String(j.id_judoka), j]))
    : new Map();

  const enriched = filtered.map(c => {
    const judoka = judokasById.get(String(c.id_judoka));

    return {
      ...c,
      judoka_nom: judoka ? `${judoka.prenom} ${judoka.nom}` : c.id_judoka
    };
  });

  return {
    competition,
    combats: enriched,
    isAdmin: admin,
    canManageCompetition: canManageCompetition(user, competition),
    judokas: admin ? judokas : []
  };
}

function saveCompetition(competition) {
  const user = getCurrentUser();
  const ownerJudokaId = resolveCompetitionOwnerId(user, competition);

  if (!competition.nom || !competition.date) {
    throw new Error("Nom et date obligatoires.");
  }

  const sheet = getSpreadsheet().getSheetByName(SHEET_COMPETITIONS);

  if (!sheet) {
    throw new Error("Onglet introuvable : " + SHEET_COMPETITIONS);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  const idIndex = headers.indexOf("id_competition");
  const judokaIdIndex = headers.indexOf("id_judoka");
  const nomIndex = headers.indexOf("nom");
  const dateIndex = headers.indexOf("date");
  const lieuIndex = headers.indexOf("lieu");

  if (idIndex === -1 || judokaIdIndex === -1 || nomIndex === -1 || dateIndex === -1 || lieuIndex === -1) {
    throw new Error("Colonnes attendues dans Competitions : id_competition, id_judoka, nom, date, lieu");
  }

  if (competition.id_competition) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]) === String(competition.id_competition)) {
        const existingCompetition = {};
        headers.forEach((header, index) => {
          existingCompetition[header] = serializeCellValue(data[i][index]);
        });

        if (!canManageCompetition(user, existingCompetition)) {
          throw new Error("Modification de cette compétition non autorisée.");
        }

        sheet.getRange(i + 1, judokaIdIndex + 1).setValue(ownerJudokaId);
        sheet.getRange(i + 1, nomIndex + 1).setValue(competition.nom);
        sheet.getRange(i + 1, dateIndex + 1).setValue(competition.date);
        sheet.getRange(i + 1, lieuIndex + 1).setValue(competition.lieu || "");

        return {
          success: true,
          id_competition: competition.id_competition,
          message: "Compétition modifiée."
        };
      }
    }
  }

  const idCompetition = "COMP" + new Date().getTime();

  sheet.appendRow([
    idCompetition,
    ownerJudokaId,
    competition.nom,
    competition.date,
    competition.lieu || ""
  ]);

  return {
    success: true,
    id_competition: idCompetition,
    message: "Compétition créée."
  };
}

function ajouterCombat(combat) {
  const user = getCurrentUser();
  const admin = isAdmin(user);

  if (!combat.id_competition) {
    throw new Error("Compétition obligatoire.");
  }

  if (!combat.resultat) {
    throw new Error("Résultat obligatoire.");
  }

  const idJudoka = admin && combat.id_judoka
    ? combat.id_judoka
    : user.id_judoka;

  if (!idJudoka) {
    throw new Error("Judoka obligatoire.");
  }

  const sheet = getSpreadsheet().getSheetByName(SHEET_COMBATS);

  if (!sheet) {
    throw new Error("Onglet introuvable : " + SHEET_COMBATS);
  }

  const idCombat = "CB" + new Date().getTime();

  sheet.appendRow([
    idCombat,
    idJudoka,
    combat.id_competition,
    combat.adversaire || "",
    combat.resultat,
    combat.commentaire || ""
  ]);

  return {
    success: true,
    message: "Combat ajouté."
  };
}

function updateCombat(combat) {
  const user = getCurrentUser();
  const admin = isAdmin(user);

  if (!combat.id_combat) {
    throw new Error("Combat obligatoire.");
  }

  if (!combat.resultat) {
    throw new Error("Résultat obligatoire.");
  }

  const sheet = getSpreadsheet().getSheetByName(SHEET_COMBATS);

  if (!sheet) {
    throw new Error("Onglet introuvable : " + SHEET_COMBATS);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  const combatIdIndex = headers.indexOf("id_combat");
  const judokaIdIndex = headers.indexOf("id_judoka");
  const competitionIdIndex = headers.indexOf("id_competition");
  const adversaireIndex = headers.indexOf("adversaire");
  const resultatIndex = headers.indexOf("resultat");
  const commentaireIndex = headers.indexOf("commentaire");

  if (
    combatIdIndex === -1 ||
    judokaIdIndex === -1 ||
    competitionIdIndex === -1 ||
    adversaireIndex === -1 ||
    resultatIndex === -1 ||
    commentaireIndex === -1
  ) {
    throw new Error("Colonnes attendues dans Combats : id_combat, id_judoka, id_competition, adversaire, resultat, commentaire");
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][combatIdIndex]) === String(combat.id_combat)) {
      if (!admin && String(data[i][judokaIdIndex]) !== String(user.id_judoka)) {
        throw new Error("Modification de ce combat non autorisée.");
      }

      const idJudoka = admin && combat.id_judoka
        ? combat.id_judoka
        : data[i][judokaIdIndex];

      if (!idJudoka) {
        throw new Error("Judoka obligatoire.");
      }

      sheet.getRange(i + 1, judokaIdIndex + 1).setValue(idJudoka);
      sheet.getRange(i + 1, competitionIdIndex + 1).setValue(combat.id_competition || data[i][competitionIdIndex]);
      sheet.getRange(i + 1, adversaireIndex + 1).setValue(combat.adversaire || "");
      sheet.getRange(i + 1, resultatIndex + 1).setValue(combat.resultat);
      sheet.getRange(i + 1, commentaireIndex + 1).setValue(combat.commentaire || "");

      return {
        success: true,
        message: "Combat modifié."
      };
    }
  }

  throw new Error("Combat introuvable.");
}

function deleteCompetition(id_competition) {
  const user = getCurrentUser();

  if (!id_competition) {
    throw new Error("Compétition obligatoire.");
  }

  const ss = getSpreadsheet();
  const competitionSheet = ss.getSheetByName(SHEET_COMPETITIONS);
  const combatSheet = ss.getSheetByName(SHEET_COMBATS);

  if (!competitionSheet) {
    throw new Error("Onglet introuvable : " + SHEET_COMPETITIONS);
  }

  if (!combatSheet) {
    throw new Error("Onglet introuvable : " + SHEET_COMBATS);
  }

  const competitionData = competitionSheet.getDataRange().getValues();
  const competitionHeaders = competitionData[0].map(h => String(h).trim());
  const competitionIdIndex = competitionHeaders.indexOf("id_competition");

  if (competitionIdIndex === -1) {
    throw new Error("Colonne attendue dans Competitions : id_competition");
  }

  let competitionRow = -1;
  let competition = null;

  for (let i = 1; i < competitionData.length; i++) {
    if (String(competitionData[i][competitionIdIndex]) === String(id_competition)) {
      competitionRow = i + 1;
      competition = {};
      competitionHeaders.forEach((header, index) => {
        competition[header] = serializeCellValue(competitionData[i][index]);
      });
      break;
    }
  }

  if (competitionRow === -1) {
    throw new Error("Compétition introuvable.");
  }

  if (!canManageCompetition(user, competition)) {
    throw new Error("Suppression de cette compétition non autorisée.");
  }

  const combatData = combatSheet.getDataRange().getValues();
  const combatHeaders = combatData[0].map(h => String(h).trim());
  const combatCompetitionIndex = combatHeaders.indexOf("id_competition");

  if (combatCompetitionIndex === -1) {
    throw new Error("Colonne attendue dans Combats : id_competition");
  }

  let deletedCombats = 0;

  for (let i = combatData.length - 1; i >= 1; i--) {
    if (String(combatData[i][combatCompetitionIndex]) === String(id_competition)) {
      combatSheet.deleteRow(i + 1);
      deletedCombats++;
    }
  }

  competitionSheet.deleteRow(competitionRow);

  return {
    success: true,
    message: deletedCombats
      ? `Compétition supprimée avec ${deletedCombats} combat(s).`
      : "Compétition supprimée."
  };
}

function deleteCombat(id_combat) {
  const user = getCurrentUser();
  const admin = isAdmin(user);

  if (!id_combat) {
    throw new Error("Combat obligatoire.");
  }

  const sheet = getSpreadsheet().getSheetByName(SHEET_COMBATS);

  if (!sheet) {
    throw new Error("Onglet introuvable : " + SHEET_COMBATS);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const combatIdIndex = headers.indexOf("id_combat");
  const judokaIdIndex = headers.indexOf("id_judoka");

  if (combatIdIndex === -1 || judokaIdIndex === -1) {
    throw new Error("Colonnes attendues dans Combats : id_combat, id_judoka");
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][combatIdIndex]) === String(id_combat)) {
      if (!admin && String(data[i][judokaIdIndex]) !== String(user.id_judoka)) {
        throw new Error("Suppression de ce combat non autorisée.");
      }

      sheet.deleteRow(i + 1);

      return {
        success: true,
        message: "Combat supprimé."
      };
    }
  }

  throw new Error("Combat introuvable.");
}

function getRowsAsObjects(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    const names = ss.getSheets().map(s => s.getName()).join(", ");
    throw new Error("Onglet introuvable : " + sheetName + ". Onglets disponibles : " + names);
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map(h => String(h).trim());

  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = serializeCellValue(row[index]);
    });
    return obj;
  }).filter(row => {
    return Object.values(row).some(value => String(value || "").trim() !== "");
  });
}

function serializeCellValue(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  if (value === null || value === undefined) {
    return "";
  }

  return value;
}
