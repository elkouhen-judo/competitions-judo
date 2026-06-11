module.exports = function createBusinessModule(deps) {
  const {
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
  } = deps;

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
        judoka_nom: judoka ? `${judoka.prenom} ${normalizeLastName(judoka.nom)}` : combat.id_judoka
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
      categorie_age: competition.categorie_age || "",
      categorie_poids: competition.categorie_poids || "",
      classement: competition.classement || ""
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

  return {
    getCompetitionsForUser,
    methods: {
      getCompetitionDetail,
      saveCompetition,
      ajouterCombat,
      updateCombat,
      deleteCompetition,
      deleteCombat
    }
  };
};
