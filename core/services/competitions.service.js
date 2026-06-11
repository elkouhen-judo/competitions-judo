module.exports = function createCompetitionsService(deps) {
  const {
    combatsRepository,
    competitionsRepository,
    userContextService,
    normalizeLastName,
    canManageCompetition,
    isAdmin,
    isParent,
    resolveCompetitionOwnerId,
    buildCompetitionId,
    createCompetition,
    createCompetitionRecord
  } = deps;

  async function getCompetitionsForUser(user, managedJudokaIds) {
    if (isAdmin(user)) {
      return competitionsRepository.listAll();
    }

    if (isParent(user)) {
      if (!managedJudokaIds || !managedJudokaIds.length) return [];
      return competitionsRepository.listByJudokaIds(managedJudokaIds);
    }

    return competitionsRepository.listByJudoka(user.id_judoka);
  }

  async function getCompetitionDetail(email, idCompetition) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const admin = isAdmin(user);
    const parent = isParent(user);
    const managedJudokaIds = userContext.managedJudokaIds || [];
    const competition = await competitionsRepository.getById(idCompetition);

    if (!competition) {
      throw new Error("Compétition introuvable.");
    }

    if (!canManageCompetition(user, competition, managedJudokaIds)) {
      throw new Error("Accès refusé à cette compétition.");
    }

    let filtered = [];
    if (!admin && !parent) {
      filtered = await combatsRepository.listByCompetitionAndJudoka(idCompetition, user.id_judoka);
    } else if (parent) {
      filtered = await combatsRepository.listByCompetitionAndJudokaIds(idCompetition, managedJudokaIds);
    } else {
      filtered = await combatsRepository.listByCompetition(idCompetition);
    }

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
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const managedJudokaIds = userContext.managedJudokaIds || [];
    const ownerJudokaId = resolveCompetitionOwnerId(user, competition, managedJudokaIds);
    const competitionDraft = createCompetition(competition, ownerJudokaId);

    const payload = competitionDraft.toRecord();

    if (competition.id_competition) {
      const existingCompetition = await competitionsRepository.getById(competition.id_competition);
      if (!existingCompetition) throw new Error("Compétition introuvable.");
      if (!canManageCompetition(user, existingCompetition, managedJudokaIds)) {
        throw new Error("Modification de cette compétition non autorisée.");
      }

      await competitionsRepository.update(competition.id_competition, payload);
      return {
        success: true,
        id_competition: competition.id_competition,
        message: "Compétition modifiée."
      };
    }

    const newCompetition = createCompetitionRecord(competition, ownerJudokaId, buildCompetitionId);
    await competitionsRepository.insert(newCompetition);

    return {
      success: true,
      id_competition: newCompetition.id_competition,
      message: "Compétition créée."
    };
  }

  async function deleteCompetition(email, idCompetition) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const managedJudokaIds = userContext.managedJudokaIds || [];

    if (!idCompetition) throw new Error("Compétition obligatoire.");

    const competition = await competitionsRepository.getById(idCompetition);
    if (!competition) throw new Error("Compétition introuvable.");
    if (!canManageCompetition(user, competition, managedJudokaIds)) {
      throw new Error("Suppression de cette compétition non autorisée.");
    }

    await competitionsRepository.remove(idCompetition);
    return { success: true, message: "Compétition supprimée." };
  }

  return {
    getCompetitionsForUser,
    methods: {
      deleteCompetition,
      getCompetitionDetail,
      saveCompetition
    }
  };
};
