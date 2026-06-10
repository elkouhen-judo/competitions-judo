const SUPABASE_URL_PROPERTY = "SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY_PROPERTY = "SUPABASE_SERVICE_ROLE_KEY";

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Kiroku - Suivi Judo")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function authorizeAppsScriptScopes() {
  UrlFetchApp.fetch("https://www.google.com/generate_204", {
    muteHttpExceptions: true
  });
  PropertiesService.getScriptProperties();
  Session.getActiveUser().getEmail();
}

function getSupabaseConfig() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty(SUPABASE_URL_PROPERTY);
  const serviceRoleKey = props.getProperty(SUPABASE_SERVICE_ROLE_KEY_PROPERTY);

  if (!url || !serviceRoleKey) {
    throw new Error("Configuration Supabase manquante : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont obligatoires.");
  }

  return {
    url: url.replace(/\/$/, ""),
    serviceRoleKey
  };
}

function supabaseRequest(table, query, options) {
  const config = getSupabaseConfig();
  const method = options && options.method ? options.method : "get";
  const requestUrl = `${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const headers = {
    "apikey": config.serviceRoleKey,
    "Authorization": "Bearer " + config.serviceRoleKey,
    "Content-Type": "application/json"
  };

  if (options && options.prefer) {
    headers["Prefer"] = options.prefer;
  }

  const params = {
    method,
    headers,
    muteHttpExceptions: true
  };

  if (options && Object.prototype.hasOwnProperty.call(options, "payload")) {
    params.payload = JSON.stringify(options.payload);
  }

  const response = UrlFetchApp.fetch(requestUrl, params);
  const status = response.getResponseCode();
  const body = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(`Erreur Supabase ${status} sur ${table} : ${body}`);
  }

  if (!body) {
    return null;
  }

  return JSON.parse(body);
}

function supabaseSelect(table, query) {
  return normalizeRows(supabaseRequest(table, query || "select=*", { method: "get" }) || []);
}

function supabaseSelectOne(table, query) {
  const separator = query ? "&" : "";
  const rows = supabaseSelect(table, `${query || "select=*"}${separator}limit=1`);
  return rows.length ? rows[0] : null;
}

function supabaseInsert(table, payload) {
  const rows = supabaseRequest(table, "select=*", {
    method: "post",
    payload,
    prefer: "return=representation"
  });

  return normalizeRows(rows || [])[0] || null;
}

function supabasePatch(table, query, payload) {
  const rows = supabaseRequest(table, `${query}&select=*`, {
    method: "patch",
    payload,
    prefer: "return=representation"
  });

  return normalizeRows(rows || [])[0] || null;
}

function supabaseDelete(table, query) {
  supabaseRequest(table, query, {
    method: "delete",
    prefer: "return=minimal"
  });
}

function normalizeRows(rows) {
  return rows.map(row => {
    const normalized = {};

    Object.keys(row).forEach(key => {
      normalized[key] = row[key] === null || row[key] === undefined ? "" : row[key];
    });

    return normalized;
  });
}

function eqFilter(column, value) {
  return `${column}=eq.${encodeURIComponent(String(value))}`;
}

function getCurrentUser() {
  return getCurrentUserContext().user;
}

function getCurrentUserContext() {
  const email = Session.getActiveUser().getEmail();

  if (!email) {
    throw new Error("Utilisateur non identifié.");
  }

  const user = supabaseSelectOne("judokas", `email=ilike.${encodeURIComponent(email.trim())}`);

  if (!user) {
    throw new Error("Accès refusé pour : " + email);
  }

  const judokas = isAdmin(user) ? getJudokasCached() : [];

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
    throw new Error("Judoka participant obligatoire.");
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
      error: e.message,
      scriptUrl: ScriptApp.getService().getUrl()
    };
  }
}

function testInitialData() {
  const data = getInitialData();
  console.log(JSON.stringify(data, null, 2));
}

function getJudokas() {
  return supabaseSelect("judokas", "select=*&order=nom.asc,prenom.asc");
}

function getJudokasCached() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("judokas");
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const judokas = getJudokas();
  if (judokas && judokas.length) {
    // Mise en cache pour 5 minutes (300 secondes)
    cache.put("judokas", JSON.stringify(judokas), 300);
  }
  return judokas;
}

function getCompetitions() {
  return supabaseSelect("competitions", "select=*&order=date.desc");
}

function getCompetitionsForUser(user) {
  if (isAdmin(user)) {
    return getCompetitions();
  }

  return supabaseSelect("competitions", `select=*&${eqFilter("id_judoka", user.id_judoka)}&order=date.desc`);
}

function getCompetitionById(idCompetition) {
  return supabaseSelectOne("competitions", `select=*&${eqFilter("id_competition", idCompetition)}`);
}

function getCombatById(idCombat) {
  return supabaseSelectOne("combats", `select=*&${eqFilter("id_combat", idCombat)}`);
}

function getCompetitionDetail(id_competition) {
  const userContext = getCurrentUserContext();
  const user = userContext.user;
  const admin = isAdmin(user);
  const competition = getCompetitionById(id_competition);

  if (!competition) {
    throw new Error("Compétition introuvable.");
  }

  if (!canManageCompetition(user, competition)) {
    throw new Error("Accès refusé à cette compétition.");
  }

  let query = `select=*&${eqFilter("id_competition", id_competition)}`;
  if (!admin) {
    query += `&${eqFilter("id_judoka", user.id_judoka)}`;
  }
  let filtered = supabaseSelect("combats", query);

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

  const payload = {
    id_judoka: ownerJudokaId,
    nom: competition.nom,
    date: competition.date,
    lieu: competition.lieu || ""
  };

  if (competition.id_competition) {
    const existingCompetition = getCompetitionById(competition.id_competition);

    if (!existingCompetition) {
      throw new Error("Compétition introuvable.");
    }

    if (!canManageCompetition(user, existingCompetition)) {
      throw new Error("Modification de cette compétition non autorisée.");
    }

    supabasePatch("competitions", eqFilter("id_competition", competition.id_competition), payload);

    return {
      success: true,
      id_competition: competition.id_competition,
      message: "Compétition modifiée."
    };
  }

  const idCompetition = "COMP" + new Date().getTime();

  supabaseInsert("competitions", {
    id_competition: idCompetition,
    id_judoka: ownerJudokaId,
    nom: competition.nom,
    date: competition.date,
    lieu: competition.lieu || ""
  });

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

  const idCombat = "CB" + new Date().getTime();

  supabaseInsert("combats", {
    id_combat: idCombat,
    id_judoka: idJudoka,
    id_competition: combat.id_competition,
    adversaire: combat.adversaire || "",
    resultat: combat.resultat,
    deroule: combat.deroule || ""
  });

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

  const existingCombat = getCombatById(combat.id_combat);

  if (!existingCombat) {
    throw new Error("Combat introuvable.");
  }

  if (!admin && String(existingCombat.id_judoka) !== String(user.id_judoka)) {
    throw new Error("Modification de ce combat non autorisée.");
  }

  const idJudoka = admin && combat.id_judoka
    ? combat.id_judoka
    : existingCombat.id_judoka;

  if (!idJudoka) {
    throw new Error("Judoka obligatoire.");
  }

  supabasePatch("combats", eqFilter("id_combat", combat.id_combat), {
    id_judoka: idJudoka,
    id_competition: combat.id_competition || existingCombat.id_competition,
    adversaire: combat.adversaire || "",
    resultat: combat.resultat,
    deroule: combat.deroule || ""
  });

  return {
    success: true,
    message: "Combat modifié."
  };
}

function deleteCompetition(id_competition) {
  const user = getCurrentUser();

  if (!id_competition) {
    throw new Error("Compétition obligatoire.");
  }

  const competition = getCompetitionById(id_competition);

  if (!competition) {
    throw new Error("Compétition introuvable.");
  }

  if (!canManageCompetition(user, competition)) {
    throw new Error("Suppression de cette compétition non autorisée.");
  }

  // La suppression en cascade des combats est gérée par Supabase.
  supabaseDelete("competitions", eqFilter("id_competition", id_competition));

  return {
    success: true,
    message: "Compétition supprimée."
  };
}

function deleteCombat(id_combat) {
  const user = getCurrentUser();
  const admin = isAdmin(user);

  if (!id_combat) {
    throw new Error("Combat obligatoire.");
  }

  const combat = getCombatById(id_combat);

  if (!combat) {
    throw new Error("Combat introuvable.");
  }

  if (!admin && String(combat.id_judoka) !== String(user.id_judoka)) {
    throw new Error("Suppression de ce combat non autorisée.");
  }

  supabaseDelete("combats", eqFilter("id_combat", id_combat));

  return {
    success: true,
    message: "Combat supprimé."
  };
}
