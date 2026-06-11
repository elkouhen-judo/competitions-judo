const { randomUUID } = require("node:crypto");
const createAdminModule = require("./_core-admin");
const createBusinessModule = require("./_core-business");

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

function isJwtLikeToken(value) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(String(value || ""));
}

function createSupabaseHeaders(apiKey, options = {}) {
  const headers = {
    apikey: apiKey
  };

  if (options.authorizationToken) {
    headers.Authorization = `Bearer ${options.authorizationToken}`;
  }

  if (options.contentType !== false) {
    headers["Content-Type"] = "application/json";
  }

  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  return headers;
}

async function supabaseRequest(table, query, options = {}) {
  const config = getSupabaseConfig();
  const method = options.method || "get";
  const requestUrl = `${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const headers = createSupabaseHeaders(config.serviceRoleKey, {
    authorizationToken: isJwtLikeToken(config.serviceRoleKey) ? config.serviceRoleKey : "",
    prefer: options.prefer
  });

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

function normalizeLastName(value) {
  return cleanText(value).toLocaleUpperCase("fr-FR");
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function buildJudokaId() {
  return `JUDO${randomUUID().replace(/-/g, "")}`;
}

async function supabaseRpc(functionName, payload) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: createSupabaseHeaders(config.serviceRoleKey, {
      authorizationToken: isJwtLikeToken(config.serviceRoleKey) ? config.serviceRoleKey : ""
    }),
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

function isAdmin(user) {
  return String(user.role || "").toUpperCase().trim() === "ADMIN";
}

function isParent(user) {
  return String(user.profile_type || "").toUpperCase().trim() === "PARENT";
}

async function getJudokas() {
  return supabaseSelect("judokas", "select=*&order=nom.asc,prenom.asc");
}

async function getCurrentUser(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  return supabaseSelectOne("judokas", `select=*&${eqFilter("email", normalizedEmail)}`);
}

async function assertJudokaEmailAvailable(email, currentIdJudoka) {
  if (!email) {
    return;
  }

  const existingUser = await getCurrentUser(email);
  if (existingUser && String(existingUser.id_judoka) !== String(currentIdJudoka || "")) {
    throw new Error("Un autre profil utilise déjà cet email.");
  }
}

async function getJudokaById(idJudoka) {
  return supabaseSelectOne("judokas", `select=*&${eqFilter("id_judoka", idJudoka)}`);
}

async function getParentManagedJudokas(idParent) {
  const rows = await supabaseSelect("parent_judokas", `select=id_judoka&${eqFilter("id_parent", idParent)}`);
  if (!rows.length) return [];

  const ids = rows.map(row => row.id_judoka).join(",");
  return supabaseSelect("judokas", `select=*&id_judoka=in.(${ids})&order=nom.asc,prenom.asc`);
}

async function getManagedChild(idParent, idJudoka) {
  const link = await supabaseSelectOne(
    "parent_judokas",
    `select=id_parent,id_judoka&${eqFilter("id_parent", idParent)}&${eqFilter("id_judoka", idJudoka)}`
  );
  if (!link) return null;
  return getJudokaById(idJudoka);
}

function canManageChildrenProfile(user) {
  return isParent(user);
}

function assertCanManageChildrenProfile(user) {
  if (!canManageChildrenProfile(user)) {
    throw new Error("Gestion des enfants non disponible pour ce profil.");
  }
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

async function getCombatsForJudoka(idJudoka) {
  return supabaseSelect("combats", `select=*&${eqFilter("id_judoka", idJudoka)}`);
}

function getCurrentSeasonBounds(referenceDate = new Date()) {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  const startYear = month >= 8 ? year : year - 1;
  return {
    start: `${startYear}-09-01`,
    end: `${startYear + 1}-08-31`,
    label: `${startYear}-${startYear + 1}`
  };
}

function isDateWithinSeason(dateValue, bounds) {
  const value = String(dateValue || "");
  return value >= bounds.start && value <= bounds.end;
}

function getCompetitionResultRank(value) {
  const ranking = {
    "1er": 1,
    "2e": 2,
    "3e": 3,
    "5e": 5,
    "7e": 7,
    "non classé": 999
  };
  return ranking[String(value || "").toLowerCase()] || Number.POSITIVE_INFINITY;
}

function getCompetitionCategoryLabel(competition) {
  return [competition.categorie_age, competition.categorie_poids].filter(Boolean).join(" - ");
}

async function getAccessibleJudokaProfile(email, idJudoka) {
  const userContext = await getCurrentUserContext(email);
  const user = userContext.user;
  const targetId = idJudoka || user.id_judoka;
  const target = await getJudokaById(targetId);

  if (!target) {
    throw new Error("Judoka introuvable.");
  }

  if (isAdmin(user)) {
    return { user, target };
  }

  if (isParent(user)) {
    if (!(userContext.managedJudokaIds || []).includes(String(targetId))) {
      throw new Error("Accès refusé à cette fiche judoka.");
    }
    return { user, target };
  }

  if (String(user.id_judoka) !== String(targetId)) {
    throw new Error("Accès refusé à cette fiche judoka.");
  }

  return { user, target };
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
  if (isAdmin(user)) {
    const ownerJudokaId = competition.id_judoka;
    if (!ownerJudokaId) throw new Error("Judoka participant obligatoire.");
    return ownerJudokaId;
  }

  if (isParent(user)) {
    const ownerJudokaId = competition.id_judoka;
    if (!ownerJudokaId) throw new Error("Judoka participant obligatoire.");
    if (!(managedJudokaIds || []).includes(String(ownerJudokaId))) {
      throw new Error("Ce judoka n'est pas dans votre liste.");
    }
    return ownerJudokaId;
  }

  return user.id_judoka;
}

async function getCompetitionById(idCompetition) {
  return supabaseSelectOne("competitions", `select=*&${eqFilter("id_competition", idCompetition)}`);
}

async function getCombatById(idCombat) {
  return supabaseSelectOne("combats", `select=*&${eqFilter("id_combat", idCombat)}`);
}

const adminModule = createAdminModule({
  supabaseSelect,
  supabaseSelectOne,
  supabaseInsert,
  supabasePatch,
  supabaseDelete,
  eqFilter,
  cleanText,
  normalizeEmail,
  isValidEmail,
  isAdmin,
  getCurrentUser,
  getJudokaById
});

const businessModule = createBusinessModule({
  supabaseSelect,
  supabaseInsert,
  supabasePatch,
  supabaseDelete,
  eqFilter,
  isAdmin,
  isParent,
  normalizeLastName,
  getCurrentUserContext,
  canManageCompetition,
  canManageCombatFor,
  resolveCompetitionOwnerId,
  getCompetitionById,
  getCombatById
});

async function getInitialData(email) {
  const currentUser = await getCurrentUser(email);
  if (!currentUser) {
    const invitation = await adminModule.getAccessInvitation(email);
    if (invitation) {
      throw new Error("Invitation trouvée. Finalisez votre profil.");
    }

    throw new Error("Accès non autorisé. Une invitation est requise.");
  }

  const userContext = await getCurrentUserContext(email);
  const user = userContext.user;
  const admin = isAdmin(user);
  const parent = isParent(user);

  return {
    user,
    isAdmin: admin,
    isParent: parent,
    canManageChildren: canManageChildrenProfile(user),
    competitions: await businessModule.getCompetitionsForUser(user, userContext.managedJudokaIds),
    judokas: (admin || parent) ? userContext.judokas : []
  };
}

async function registerProfile(email, profile) {
  const invitation = await adminModule.getAccessInvitation(email);
  if (!invitation) {
    throw new Error("Accès non autorisé. Une invitation est requise.");
  }

  return supabaseRpc("register_profile", {
    p_email: cleanText(email).toLowerCase(),
    p_type: invitation.invited_profile_type || "JUDOKA",
    p_prenom: profile && profile.prenom,
    p_nom: profile && profile.nom,
    p_children: []
  });
}

async function getChildrenManagement(email) {
  const user = await getCurrentUser(email);
  if (!user) {
    throw new Error(`Accès refusé pour : ${email}`);
  }
  assertCanManageChildrenProfile(user);

  return {
    user,
    isParent: isParent(user),
    children: await getParentManagedJudokas(user.id_judoka)
  };
}

async function getJudokaProfile(email, idJudoka) {
  const { target } = await getAccessibleJudokaProfile(email, idJudoka);
  const competitions = await supabaseSelect("competitions", `select=*&${eqFilter("id_judoka", target.id_judoka)}&order=date.desc`);
  const combats = await getCombatsForJudoka(target.id_judoka);
  const bounds = getCurrentSeasonBounds();
  const seasonCompetitions = competitions.filter(c => isDateWithinSeason(c.date, bounds));
  const seasonCompetitionIds = new Set(seasonCompetitions.map(c => String(c.id_competition)));
  const seasonCombats = combats
    .filter(c => seasonCompetitionIds.has(String(c.id_competition)));
  const seasonWins = seasonCombats.filter(c => c.resultat === "V").length;
  const seasonLosses = seasonCombats.filter(c => c.resultat === "D").length;
  const competitionsById = new Map(competitions.map(c => [String(c.id_competition), c]));
  const lastCombatCompetition = combats
    .map(combat => ({
      combat,
      competition: competitionsById.get(String(combat.id_competition))
    }))
    .filter(entry => entry.competition)
    .sort((a, b) => {
      const dateDiff = String(b.competition.date || "").localeCompare(String(a.competition.date || ""));
      if (dateDiff !== 0) return dateDiff;
      return String(b.combat.id_combat || "").localeCompare(String(a.combat.id_combat || ""));
    })[0] || null;
  const bestSeasonResults = seasonCompetitions
    .filter(c => c.classement && Number.isFinite(getCompetitionResultRank(c.classement)))
    .sort((a, b) => {
      const rankDiff = getCompetitionResultRank(a.classement) - getCompetitionResultRank(b.classement);
      if (rankDiff !== 0) return rankDiff;
      return String(b.date || "").localeCompare(String(a.date || ""));
    })
    .slice(0, 3)
    .map(c => ({
      id_competition: c.id_competition,
      nom: c.nom,
      date: c.date,
      classement: c.classement
    }));
  const lastCompetition = competitions[0] || null;
  const lastCompetitionForCategory = lastCombatCompetition ? lastCombatCompetition.competition : lastCompetition;

  return {
    judoka: target,
    season: bounds,
    lastCompetition: lastCompetition
      ? {
          id_competition: lastCompetition.id_competition,
          nom: lastCompetition.nom,
          date: lastCompetition.date,
          category: lastCompetitionForCategory ? getCompetitionCategoryLabel(lastCompetitionForCategory) : "",
          weightCategory: lastCompetitionForCategory ? (lastCompetitionForCategory.categorie_poids || "") : ""
        }
      : null,
    bestSeasonResults,
    seasonCombatCount: seasonCombats.length,
    seasonCompetitionCount: seasonCompetitions.length,
    seasonWins,
    seasonLosses
  };
}

async function saveManagedChild(email, child) {
  const user = await getCurrentUser(email);
  if (!user) {
    throw new Error(`Accès refusé pour : ${email}`);
  }
  assertCanManageChildrenProfile(user);

  const prenom = cleanText(child && child.prenom);
  const nom = cleanText(child && child.nom);
  const childEmail = normalizeEmail(child && child.email);
  if (!prenom || !nom) {
    throw new Error("Prénom et nom de l'enfant obligatoires.");
  }
  if (childEmail && !isValidEmail(childEmail)) {
    throw new Error("Email de l'enfant invalide.");
  }
  await assertJudokaEmailAvailable(childEmail, child && child.id_judoka);

  if (child && child.id_judoka) {
    const existingChild = await getManagedChild(user.id_judoka, child.id_judoka);
    if (!existingChild) {
      throw new Error("Enfant introuvable.");
    }

    await supabasePatch("judokas", eqFilter("id_judoka", child.id_judoka), {
      prenom,
      nom,
      email: childEmail || null
    });

    return {
      success: true,
      id_judoka: child.id_judoka,
      message: "Enfant modifié."
    };
  }

  const idJudoka = buildJudokaId();
  await supabaseInsert("judokas", {
    id_judoka: idJudoka,
    email: childEmail || null,
    prenom,
    nom,
    profile_type: "JUDOKA",
    role: "NORMAL"
  });
  await supabaseInsert("parent_judokas", {
    id_parent: user.id_judoka,
    id_judoka: idJudoka
  });

  return {
    success: true,
    id_judoka: idJudoka,
    message: "Enfant ajouté."
  };
}

async function deleteManagedChild(email, idJudoka) {
  const user = await getCurrentUser(email);
  if (!user) {
    throw new Error(`Accès refusé pour : ${email}`);
  }
  assertCanManageChildrenProfile(user);

  if (!idJudoka) {
    throw new Error("Enfant obligatoire.");
  }

  const child = await getManagedChild(user.id_judoka, idJudoka);
  if (!child) {
    throw new Error("Enfant introuvable.");
  }

  const competition = await supabaseSelectOne("competitions", `select=id_competition&${eqFilter("id_judoka", idJudoka)}`);
  if (competition) {
    throw new Error("Impossible de supprimer cet enfant tant qu'il possède des compétitions.");
  }

  const combat = await supabaseSelectOne("combats", `select=id_combat&${eqFilter("id_judoka", idJudoka)}`);
  if (combat) {
    throw new Error("Impossible de supprimer cet enfant tant qu'il possède des combats.");
  }

  await supabaseDelete("parent_judokas", `${eqFilter("id_parent", user.id_judoka)}&${eqFilter("id_judoka", idJudoka)}`);

  const otherParentLink = await supabaseSelectOne("parent_judokas", `select=id_parent&${eqFilter("id_judoka", idJudoka)}`);
  let message = "Enfant retiré.";
  if (!otherParentLink && !cleanText(child.email)) {
    await supabaseDelete("judokas", eqFilter("id_judoka", idJudoka));
    message = "Enfant supprimé.";
  }
  return {
    success: true,
    message
  };
}
const methods = {
  getInitialData,
  getChildrenManagement,
  getJudokaProfile,
  registerProfile,
  saveManagedChild,
  deleteManagedChild,
  ...adminModule.methods,
  ...businessModule.methods
};

module.exports = {
  getSupabaseConfig,
  methods,
  verifySupabaseUser
};
