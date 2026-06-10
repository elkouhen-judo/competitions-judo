const SUPABASE_URL_ENV = "SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY";
const SUPABASE_ANON_KEY_ENV = "SUPABASE_ANON_KEY";

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Configuration manquante : ${name} est obligatoire.`);
  }
  return value;
}

function getSupabaseConfig() {
  return {
    url: getRequiredEnv(SUPABASE_URL_ENV).replace(/\/$/, ""),
    serviceRoleKey: getRequiredEnv(SUPABASE_SERVICE_ROLE_KEY_ENV),
    anonKey: getRequiredEnv(SUPABASE_ANON_KEY_ENV)
  };
}

async function supabaseRequest(table, query, options = {}) {
  const config = getSupabaseConfig();
  const method = options.method || "get";
  const requestUrl = `${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json"
  };

  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  const response = await fetch(requestUrl, {
    method: method.toUpperCase(),
    headers,
    body: Object.prototype.hasOwnProperty.call(options, "payload")
      ? JSON.stringify(options.payload)
      : undefined
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Erreur Supabase ${response.status} sur ${table} : ${body}`);
  }

  return body ? JSON.parse(body) : null;
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

async function supabaseRpc(functionName, payload) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload || {})
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(body || `Erreur Supabase RPC ${functionName}.`);
  }

  return body ? JSON.parse(body) : null;
}

async function supabaseSelect(table, query) {
  return normalizeRows((await supabaseRequest(table, query || "select=*", { method: "get" })) || []);
}

async function supabaseSelectOne(table, query) {
  const separator = query ? "&" : "";
  const rows = await supabaseSelect(table, `${query || "select=*"}${separator}limit=1`);
  return rows.length ? rows[0] : null;
}

async function supabaseInsert(table, payload) {
  const rows = await supabaseRequest(table, "select=*", {
    method: "post",
    payload,
    prefer: "return=representation"
  });
  return normalizeRows(rows || [])[0] || null;
}

async function supabasePatch(table, query, payload) {
  const rows = await supabaseRequest(table, `${query}&select=*`, {
    method: "patch",
    payload,
    prefer: "return=representation"
  });
  return normalizeRows(rows || [])[0] || null;
}

async function supabaseDelete(table, query) {
  await supabaseRequest(table, query, {
    method: "delete",
    prefer: "return=minimal"
  });
}

async function verifySupabaseUser(accessToken) {
  if (!accessToken) {
    throw new Error("Utilisateur non identifié.");
  }

  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Session Supabase invalide : ${body}`);
  }

  const authUser = body ? JSON.parse(body) : {};
  if (!authUser.email) {
    throw new Error("Utilisateur non identifié.");
  }

  return authUser.email;
}

async function createConfirmedAuthUser(email, password) {
  const cleanEmail = cleanText(email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Email invalide.");
  }
  if (String(password || "").length < 6) {
    throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
  }

  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: cleanEmail,
      password,
      email_confirm: true
    })
  });
  const body = await response.text();

  if (!response.ok) {
    if (/already|registered|exists|duplicate|unique/i.test(body)) {
      throw new Error("Ce compte existe déjà. Vérifiez le mot de passe saisi ou utilisez mot de passe oublié.");
    }
    throw new Error(body || "Création du compte d'authentification impossible.");
  }

  return body ? JSON.parse(body) : {};
}

function isAdmin(user) {
  return String(user.role || "").toUpperCase().trim() === "ADMIN";
}

function isParent(user) {
  return String(user.role || "").toUpperCase().trim() === "PARENT";
}

async function getJudokas() {
  return supabaseSelect("judokas", "select=*&order=nom.asc,prenom.asc");
}

async function getCurrentUser(email) {
  return supabaseSelectOne("judokas", `email=ilike.${encodeURIComponent(email.trim())}`);
}

async function getParentManagedJudokas(idParent) {
  const rows = await supabaseSelect("parent_judokas", `select=id_judoka&${eqFilter("id_parent", idParent)}`);
  if (!rows.length) return [];

  const ids = rows.map(row => row.id_judoka).join(",");
  return supabaseSelect("judokas", `select=*&id_judoka=in.(${ids})&order=nom.asc,prenom.asc`);
}

async function getCurrentUserContext(email) {
  const user = await getCurrentUser(email);

  if (!user) {
    throw new Error(`Accès refusé pour : ${email}`);
  }

  let judokas = [];
  let managedJudokaIds = [];

  if (isAdmin(user)) {
    judokas = await getJudokas();
  } else if (isParent(user)) {
    const children = await getParentManagedJudokas(user.id_judoka);
    const alreadyIncluded = children.some(j => String(j.id_judoka) === String(user.id_judoka));
    judokas = alreadyIncluded ? children : [user, ...children];
    managedJudokaIds = judokas.map(j => String(j.id_judoka));
  }

  return { user, judokas, managedJudokaIds };
}

function canManageCombatFor(user, idJudoka, managedJudokaIds) {
  if (isAdmin(user)) return true;
  if (isParent(user)) return (managedJudokaIds || []).includes(String(idJudoka));
  return String(user.id_judoka) === String(idJudoka);
}

function canManageCompetition(user, competition, managedJudokaIds) {
  if (isAdmin(user)) return true;
  if (isParent(user)) return (managedJudokaIds || []).includes(String(competition.id_judoka));
  return String(user.id_judoka) === String(competition.id_judoka);
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

async function getCompetitions() {
  return supabaseSelect("competitions", "select=*&order=date.desc");
}

async function getCompetitionsForUser(user, managedJudokaIds) {
  if (isAdmin(user)) {
    return getCompetitions();
  }

  if (isParent(user)) {
    if (!managedJudokaIds || !managedJudokaIds.length) return [];
    return supabaseSelect("competitions", `select=*&id_judoka=in.(${managedJudokaIds.join(",")})&order=date.desc`);
  }

  return supabaseSelect("competitions", `select=*&${eqFilter("id_judoka", user.id_judoka)}&order=date.desc`);
}

async function getCompetitionById(idCompetition) {
  return supabaseSelectOne("competitions", `select=*&${eqFilter("id_competition", idCompetition)}`);
}

async function getCombatById(idCombat) {
  return supabaseSelectOne("combats", `select=*&${eqFilter("id_combat", idCombat)}`);
}

async function getInitialData(email) {
  const userContext = await getCurrentUserContext(email);
  const user = userContext.user;
  const admin = isAdmin(user);
  const parent = isParent(user);

  return {
    user,
    isAdmin: admin,
    isParent: parent,
    competitions: await getCompetitionsForUser(user, userContext.managedJudokaIds),
    judokas: (admin || parent) ? userContext.judokas : []
  };
}

async function registerProfile(email, profile) {
  return supabaseRpc("register_profile", {
    p_email: cleanText(email).toLowerCase(),
    p_type: profile && profile.type,
    p_prenom: profile && profile.prenom,
    p_nom: profile && profile.nom,
    p_children: Array.isArray(profile && profile.children) ? profile.children : []
  });
}

async function getCompetitionDetail(email, idCompetition) {
  const userContext = await getCurrentUserContext(email);
  const user = userContext.user;
  const admin = isAdmin(user);
  const parent = isParent(user);
  const managedJudokaIds = userContext.managedJudokaIds || [];
  const competition = await getCompetitionById(idCompetition);

  if (!competition) {
    throw new Error("Compétition introuvable.");
  }

  if (!canManageCompetition(user, competition, managedJudokaIds)) {
    throw new Error("Accès refusé à cette compétition.");
  }

  let query = `select=*&${eqFilter("id_competition", idCompetition)}`;
  if (!admin && !parent) {
    query += `&${eqFilter("id_judoka", user.id_judoka)}`;
  } else if (parent && managedJudokaIds.length) {
    query += `&id_judoka=in.(${managedJudokaIds.join(",")})`;
  }

  const filtered = await supabaseSelect("combats", query);
  const judokas = (admin || parent) ? userContext.judokas : [];
  const judokasById = new Map(judokas.map(j => [String(j.id_judoka), j]));
  const enriched = filtered.map(combat => {
    const judoka = judokasById.get(String(combat.id_judoka));
    return {
      ...combat,
      judoka_nom: judoka ? `${judoka.prenom} ${judoka.nom}` : combat.id_judoka
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

async function saveCompetition(email, competition) {
  const userContext = await getCurrentUserContext(email);
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
    const existingCompetition = await getCompetitionById(competition.id_competition);
    if (!existingCompetition) throw new Error("Compétition introuvable.");
    if (!canManageCompetition(user, existingCompetition, managedJudokaIds)) {
      throw new Error("Modification de cette compétition non autorisée.");
    }

    await supabasePatch("competitions", eqFilter("id_competition", competition.id_competition), payload);
    return {
      success: true,
      id_competition: competition.id_competition,
      message: "Compétition modifiée."
    };
  }

  const idCompetition = `COMP${Date.now()}`;
  await supabaseInsert("competitions", {
    id_competition: idCompetition,
    ...payload
  });

  return {
    success: true,
    id_competition: idCompetition,
    message: "Compétition créée."
  };
}

async function ajouterCombat(email, combat) {
  const userContext = await getCurrentUserContext(email);
  const user = userContext.user;
  const managedJudokaIds = userContext.managedJudokaIds || [];

  if (!combat.id_competition) throw new Error("Compétition obligatoire.");
  if (!combat.resultat) throw new Error("Résultat obligatoire.");
  if (!combat.id_judoka) throw new Error("Judoka obligatoire.");

  if (!canManageCombatFor(user, combat.id_judoka, managedJudokaIds)) {
    throw new Error("Ajout de ce combat non autorisé.");
  }

  await supabaseInsert("combats", {
    id_combat: `CB${Date.now()}`,
    id_judoka: combat.id_judoka,
    id_competition: combat.id_competition,
    adversaire: combat.adversaire || "",
    resultat: combat.resultat,
    type_victoire: combat.type_victoire || "",
    deroule: combat.deroule || ""
  });

  return { success: true, message: "Combat ajouté." };
}

async function updateCombat(email, combat) {
  const userContext = await getCurrentUserContext(email);
  const user = userContext.user;
  const managedJudokaIds = userContext.managedJudokaIds || [];

  if (!combat.id_combat) throw new Error("Combat obligatoire.");
  if (!combat.resultat) throw new Error("Résultat obligatoire.");
  if (!combat.id_judoka) throw new Error("Judoka obligatoire.");

  const existingCombat = await getCombatById(combat.id_combat);
  if (!existingCombat) throw new Error("Combat introuvable.");
  if (!canManageCombatFor(user, existingCombat.id_judoka, managedJudokaIds)) {
    throw new Error("Modification de ce combat non autorisée.");
  }
  if (!canManageCombatFor(user, combat.id_judoka, managedJudokaIds)) {
    throw new Error("Modification de ce combat non autorisée.");
  }

  await supabasePatch("combats", eqFilter("id_combat", combat.id_combat), {
    id_judoka: combat.id_judoka,
    id_competition: combat.id_competition,
    adversaire: combat.adversaire || "",
    resultat: combat.resultat,
    type_victoire: combat.type_victoire || "",
    deroule: combat.deroule || ""
  });

  return { success: true, message: "Combat modifié." };
}

async function deleteCompetition(email, idCompetition) {
  const userContext = await getCurrentUserContext(email);
  const user = userContext.user;
  const managedJudokaIds = userContext.managedJudokaIds || [];

  if (!idCompetition) throw new Error("Compétition obligatoire.");

  const competition = await getCompetitionById(idCompetition);
  if (!competition) throw new Error("Compétition introuvable.");
  if (!canManageCompetition(user, competition, managedJudokaIds)) {
    throw new Error("Suppression de cette compétition non autorisée.");
  }

  await supabaseDelete("competitions", eqFilter("id_competition", idCompetition));
  return { success: true, message: "Compétition supprimée." };
}

async function deleteCombat(email, idCombat) {
  const userContext = await getCurrentUserContext(email);
  const user = userContext.user;
  const managedJudokaIds = userContext.managedJudokaIds || [];

  if (!idCombat) throw new Error("Combat obligatoire.");

  const combat = await getCombatById(idCombat);
  if (!combat) throw new Error("Combat introuvable.");
  if (!canManageCombatFor(user, combat.id_judoka, managedJudokaIds)) {
    throw new Error("Suppression de ce combat non autorisée.");
  }

  await supabaseDelete("combats", eqFilter("id_combat", idCombat));
  return { success: true, message: "Combat supprimé." };
}

const methods = {
  getInitialData,
  registerProfile,
  getCompetitionDetail,
  saveCompetition,
  ajouterCombat,
  updateCombat,
  deleteCompetition,
  deleteCombat
};

module.exports = {
  getSupabaseConfig,
  createConfirmedAuthUser,
  methods,
  verifySupabaseUser
};
