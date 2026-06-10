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

function isJwtLikeToken(value) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(String(value || ""));
}

function createSupabaseHeaders(apiKey, options) {
  const headers = {
    "apikey": apiKey
  };
  const settings = options || {};

  if (settings.authorizationToken) {
    headers["Authorization"] = "Bearer " + settings.authorizationToken;
  }

  if (settings.contentType !== false) {
    headers["Content-Type"] = "application/json";
  }

  if (settings.prefer) {
    headers["Prefer"] = settings.prefer;
  }

  return headers;
}

function supabaseRequest(table, query, options) {
  const config = getSupabaseConfig();
  const method = options && options.method ? options.method : "get";
  const requestUrl = `${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const headers = createSupabaseHeaders(config.serviceRoleKey, {
    authorizationToken: isJwtLikeToken(config.serviceRoleKey) ? config.serviceRoleKey : "",
    prefer: options && options.prefer
  });

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

function cleanText(value) {
  return String(value || "").trim();
}

function buildJudokaId() {
  return "JUDO" + Utilities.getUuid().replace(/-/g, "");
}

function invalidateUserCaches() {
  CacheService.getUserCache().remove("currentUser");
  CacheService.getUserCache().remove("parentJudokas");
  CacheService.getScriptCache().remove("judokas");
}

function getCurrentUser() {
  return getCurrentUserContext().user;
}

function getCurrentUserCached() {
  const cache = CacheService.getUserCache();
  const cached = cache.get("currentUser");
  if (cached) {
    return JSON.parse(cached);
  }
  const user = supabaseSelectOne("judokas", `email=ilike.${encodeURIComponent(Session.getActiveUser().getEmail().trim())}`);
  if (user) {
    cache.put("currentUser", JSON.stringify(user), 300);
  }
  return user;
}

function getJudokaById(idJudoka) {
  return supabaseSelectOne("judokas", `select=*&${eqFilter("id_judoka", idJudoka)}`);
}

function getCurrentUserContext() {
  const email = Session.getActiveUser().getEmail();

  if (!email) {
    throw new Error("Utilisateur non identifié.");
  }

  const user = getCurrentUserCached();

  if (!user) {
    throw new Error("Accès refusé pour : " + email);
  }

  let judokas = [];
  let managedJudokaIds = [];

  if (isAdmin(user)) {
    judokas = getJudokasCached();
  } else if (isParent(user)) {
    const children = getParentManagedJudokas(user.id_judoka);
    // Le parent est aussi judoka : s'inclure s'il n'est pas déjà dans la liste
    const alreadyIncluded = children.some(j => String(j.id_judoka) === String(user.id_judoka));
    judokas = alreadyIncluded ? children : [user, ...children];
    managedJudokaIds = judokas.map(j => String(j.id_judoka));
  }

  return { user, judokas, managedJudokaIds };
}

function isAdmin(user) {
  return String(user.role || "").toUpperCase().trim() === "ADMIN";
}

function isParent(user) {
  return String(user.role || "").toUpperCase().trim() === "PARENT";
}

function canManageChildrenProfile(user) {
  return !isAdmin(user);
}

function assertCanManageChildrenProfile(user) {
  if (!canManageChildrenProfile(user)) {
    throw new Error("Gestion des enfants non disponible pour ce profil.");
  }
}

function getParentManagedJudokas(idParent) {
  const cache = CacheService.getUserCache();
  const cacheKey = "parentJudokas";
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const rows = supabaseSelect("parent_judokas", `select=id_judoka&${eqFilter("id_parent", idParent)}`);
  if (!rows.length) return [];

  const ids = rows.map(r => r.id_judoka).join(",");
  const judokas = supabaseSelect("judokas", `select=*&id_judoka=in.(${ids})&order=nom.asc,prenom.asc`);
  cache.put(cacheKey, JSON.stringify(judokas), 300);
  return judokas;
}

function getManagedChild(idParent, idJudoka) {
  const link = supabaseSelectOne(
    "parent_judokas",
    `select=id_parent,id_judoka&${eqFilter("id_parent", idParent)}&${eqFilter("id_judoka", idJudoka)}`
  );
  if (!link) return null;
  return getJudokaById(idJudoka);
}

function canAccessCompetition(user, competition, managedJudokaIds) {
  if (isAdmin(user)) return true;
  if (isParent(user)) return (managedJudokaIds || []).includes(String(competition.id_judoka));
  return String(competition.id_judoka) === String(user.id_judoka);
}

function canManageCombatFor(user, idJudoka, managedJudokaIds) {
  if (isAdmin(user)) return true;
  if (isParent(user)) return (managedJudokaIds || []).includes(String(idJudoka));
  return String(user.id_judoka) === String(idJudoka);
}

function canManageCompetition(user, competition, managedJudokaIds) {
  if (isAdmin(user)) return true;
  if (isParent(user)) return (managedJudokaIds || []).includes(String(competition.id_judoka));
  return String(competition.id_judoka) === String(user.id_judoka);
}

function resolveCompetitionOwnerId(user, competition, managedJudokaIds) {
  if (isAdmin(user) || isParent(user)) {
    const ownerJudokaId = competition.id_judoka;
    if (!ownerJudokaId) throw new Error("Judoka participant obligatoire.");
    if (isParent(user) && !(managedJudokaIds || []).includes(String(ownerJudokaId))) {
      throw new Error("Ce judoka n'est pas dans votre liste.");
    }
    return ownerJudokaId;
  }
  return user.id_judoka;
}

function getInitialData() {

  try {

    const userContext = getCurrentUserContext();
    const user = userContext.user;
    const admin = isAdmin(user);
    const parent = isParent(user);

    const result = {
      user: user,
      isAdmin: admin,
      isParent: parent,
      canManageChildren: canManageChildrenProfile(user),
      competitions: getCompetitionsForUser(user, userContext.managedJudokaIds),
      judokas: (admin || parent) ? userContext.judokas : []
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

function getChildrenManagement() {
  const user = getCurrentUserCached();
  if (!user) {
    throw new Error("Utilisateur non identifié.");
  }
  assertCanManageChildrenProfile(user);

  return {
    user,
    isParent: isParent(user),
    children: getParentManagedJudokas(user.id_judoka)
  };
}

function saveManagedChild(child) {
  const user = getCurrentUserCached();
  if (!user) {
    throw new Error("Utilisateur non identifié.");
  }
  assertCanManageChildrenProfile(user);

  const prenom = cleanText(child && child.prenom);
  const nom = cleanText(child && child.nom);
  if (!prenom || !nom) {
    throw new Error("Prénom et nom de l'enfant obligatoires.");
  }

  if (child && child.id_judoka) {
    const existingChild = getManagedChild(user.id_judoka, child.id_judoka);
    if (!existingChild) {
      throw new Error("Enfant introuvable.");
    }

    supabasePatch("judokas", eqFilter("id_judoka", child.id_judoka), {
      prenom,
      nom
    });
    invalidateUserCaches();

    return {
      success: true,
      id_judoka: child.id_judoka,
      message: "Enfant modifié."
    };
  }

  const idJudoka = buildJudokaId();
  supabaseInsert("judokas", {
    id_judoka: idJudoka,
    email: null,
    prenom,
    nom,
    role: "JUDOKA"
  });
  supabaseInsert("parent_judokas", {
    id_parent: user.id_judoka,
    id_judoka: idJudoka
  });

  if (!isParent(user)) {
    supabasePatch("judokas", eqFilter("id_judoka", user.id_judoka), {
      role: "PARENT"
    });
  }

  invalidateUserCaches();
  return {
    success: true,
    id_judoka: idJudoka,
    message: "Enfant ajouté."
  };
}

function deleteManagedChild(idJudoka) {
  const user = getCurrentUserCached();
  if (!user) {
    throw new Error("Utilisateur non identifié.");
  }
  assertCanManageChildrenProfile(user);

  if (!idJudoka) {
    throw new Error("Enfant obligatoire.");
  }

  const child = getManagedChild(user.id_judoka, idJudoka);
  if (!child) {
    throw new Error("Enfant introuvable.");
  }

  const competition = supabaseSelectOne("competitions", `select=id_competition&${eqFilter("id_judoka", idJudoka)}`);
  if (competition) {
    throw new Error("Impossible de supprimer cet enfant tant qu'il possède des compétitions.");
  }

  const combat = supabaseSelectOne("combats", `select=id_combat&${eqFilter("id_judoka", idJudoka)}`);
  if (combat) {
    throw new Error("Impossible de supprimer cet enfant tant qu'il possède des combats.");
  }

  supabaseDelete("parent_judokas", `${eqFilter("id_parent", user.id_judoka)}&${eqFilter("id_judoka", idJudoka)}`);

  const otherParentLink = supabaseSelectOne("parent_judokas", `select=id_parent&${eqFilter("id_judoka", idJudoka)}`);
  let message = "Enfant retiré.";
  if (!otherParentLink && !cleanText(child.email)) {
    supabaseDelete("judokas", eqFilter("id_judoka", idJudoka));
    message = "Enfant supprimé.";
  }

  invalidateUserCaches();
  const remainingChildren = getParentManagedJudokas(user.id_judoka);
  if (!remainingChildren.length && isParent(user)) {
    supabasePatch("judokas", eqFilter("id_judoka", user.id_judoka), {
      role: "JUDOKA"
    });
  }

  invalidateUserCaches();
  return {
    success: true,
    message
  };
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

function getCompetitionsForUser(user, managedJudokaIds) {
  if (isAdmin(user)) {
    return getCompetitions();
  }

  if (isParent(user)) {
    if (!managedJudokaIds || !managedJudokaIds.length) return [];
    return supabaseSelect("competitions", `select=*&id_judoka=in.(${managedJudokaIds.join(",")})&order=date.desc`);
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
  const parent = isParent(user);
  const managedJudokaIds = userContext.managedJudokaIds || [];
  const competition = getCompetitionById(id_competition);

  if (!competition) {
    throw new Error("Compétition introuvable.");
  }

  if (!canManageCompetition(user, competition, managedJudokaIds)) {
    throw new Error("Accès refusé à cette compétition.");
  }

  let query = `select=*&${eqFilter("id_competition", id_competition)}`;
  if (!admin && !parent) {
    query += `&${eqFilter("id_judoka", user.id_judoka)}`;
  } else if (parent && managedJudokaIds.length) {
    query += `&id_judoka=in.(${managedJudokaIds.join(",")})`;
  }
  const filtered = supabaseSelect("combats", query);

  const judokas = (admin || parent) ? userContext.judokas : [];
  const judokasById = new Map(judokas.map(j => [String(j.id_judoka), j]));

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
    isParent: parent,
    canManageCompetition: canManageCompetition(user, competition, managedJudokaIds),
    canEditCompetition: canManageCompetition(user, competition, managedJudokaIds),
    judokas
  };
}

function saveCompetition(competition) {
  const userContext = getCurrentUserContext();
  const user = userContext.user;
  const managedJudokaIds = userContext.managedJudokaIds || [];

  const ownerJudokaId = resolveCompetitionOwnerId(user, competition, managedJudokaIds);

  if (!competition.nom || !competition.date) {
    throw new Error("Nom et date obligatoires.");
  }

  const payload = {
    id_judoka: ownerJudokaId,
    nom: competition.nom,
    date: competition.date,
    lieu: competition.lieu || "",
    categorie_age: competition.categorie_age || "",
    categorie_poids: competition.categorie_poids || "",
    poids_pesee: competition.poids_pesee || ""
  };

  if (competition.id_competition) {
    const existingCompetition = getCompetitionById(competition.id_competition);

    if (!existingCompetition) {
      throw new Error("Compétition introuvable.");
    }

    if (!canManageCompetition(user, existingCompetition, managedJudokaIds)) {
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
    lieu: competition.lieu || "",
    categorie_age: competition.categorie_age || "",
    categorie_poids: competition.categorie_poids || "",
    poids_pesee: competition.poids_pesee || ""
  });

  return {
    success: true,
    id_competition: idCompetition,
    message: "Compétition créée."
  };
}

function ajouterCombat(combat) {
  const user = getCurrentUserCached();

  if (!user) throw new Error("Utilisateur non identifié.");
  if (!combat.id_competition) throw new Error("Compétition obligatoire.");
  if (!combat.resultat) throw new Error("Résultat obligatoire.");
  if (!combat.id_judoka) throw new Error("Judoka obligatoire.");

  let managedJudokaIds = [];
  if (isParent(user)) {
    managedJudokaIds = getParentManagedJudokas(user.id_judoka).map(j => String(j.id_judoka));
  }

  if (!canManageCombatFor(user, combat.id_judoka, managedJudokaIds)) {
    throw new Error("Ajout de ce combat non autorisé.");
  }

  const idCombat = "CB" + new Date().getTime();

  supabaseInsert("combats", {
    id_combat: idCombat,
    id_judoka: combat.id_judoka,
    id_competition: combat.id_competition,
    adversaire: combat.adversaire || "",
    resultat: combat.resultat,
    type_victoire: combat.type_victoire || "",
    deroule: combat.deroule || ""
  });

  return { success: true, message: "Combat ajouté." };
}

function updateCombat(combat) {
  const user = getCurrentUserCached();

  if (!user) throw new Error("Utilisateur non identifié.");
  if (!combat.id_combat) throw new Error("Combat obligatoire.");
  if (!combat.resultat) throw new Error("Résultat obligatoire.");
  if (!combat.id_judoka) throw new Error("Judoka obligatoire.");

  let managedJudokaIds = [];
  if (isParent(user)) {
    managedJudokaIds = getParentManagedJudokas(user.id_judoka).map(j => String(j.id_judoka));
  }

  if (!canManageCombatFor(user, combat.id_judoka, managedJudokaIds)) {
    throw new Error("Modification de ce combat non autorisée.");
  }

  supabasePatch("combats", eqFilter("id_combat", combat.id_combat), {
    id_judoka: combat.id_judoka,
    id_competition: combat.id_competition,
    adversaire: combat.adversaire || "",
    resultat: combat.resultat,
    type_victoire: combat.type_victoire || "",
    deroule: combat.deroule || ""
  });

  return { success: true, message: "Combat modifié." };
}

function deleteCompetition(id_competition) {
  const userContext = getCurrentUserContext();
  const user = userContext.user;
  const managedJudokaIds = userContext.managedJudokaIds || [];

  if (!id_competition) {
    throw new Error("Compétition obligatoire.");
  }

  const competition = getCompetitionById(id_competition);

  if (!competition) {
    throw new Error("Compétition introuvable.");
  }

  if (!canManageCompetition(user, competition, managedJudokaIds)) {
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
  const user = getCurrentUserCached();
  if (!user) throw new Error("Utilisateur non identifié.");
  if (!id_combat) throw new Error("Combat obligatoire.");

  const combat = getCombatById(id_combat);
  if (!combat) throw new Error("Combat introuvable.");

  let managedJudokaIds = [];
  if (isParent(user)) {
    managedJudokaIds = getParentManagedJudokas(user.id_judoka).map(j => String(j.id_judoka));
  }

  if (!canManageCombatFor(user, combat.id_judoka, managedJudokaIds)) {
    throw new Error("Suppression de ce combat non autorisée.");
  }

  supabaseDelete("combats", eqFilter("id_combat", id_combat));

  return { success: true, message: "Combat supprimé." };
}
