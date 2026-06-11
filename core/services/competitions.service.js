const { toDomainCompetition, toDomainJudoka } = require("./domain-adapters");

module.exports = function createCompetitionsService(deps) {
  const {
    combatsRepository,
    competitionsRepository,
    userContextService,
    normalizeLastName,
    canManageCompetition,
    assertCanManageCompetition,
    resolveJudokaDataAccess,
    resolveCompetitionOwnerId,
    buildCompetitionId,
    createCompetition
  } = deps;

  async function getCompetitionsForUser(user, managedJudokaScope) {
    const domainUser = toDomainJudoka(user);
    const access = resolveJudokaDataAccess(domainUser, managedJudokaScope);

    if (access.kind === "ALL") {
      return competitionsRepository.listAll();
    }

    if (access.kind === "MANAGED") {
      const managedJudokaIds = access.managedJudokaScope.toIds();
      if (!managedJudokaIds.length) return [];
      return competitionsRepository.listByJudokaIds(managedJudokaIds);
    }

    return competitionsRepository.listByJudoka(access.judokaId);
  }

  async function getCompetitionDetail(email, idCompetition) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const domainUser = toDomainJudoka(user);
    const managedJudokaScope = userContext.managedJudokaScope;
    const access = resolveJudokaDataAccess(domainUser, managedJudokaScope);
    const competitionRecord = await competitionsRepository.getById(idCompetition);

    if (!competitionRecord) {
      throw new Error("Compétition introuvable.");
    }
    const domainCompetition = toDomainCompetition(competitionRecord);

    assertCanManageCompetition(domainUser, domainCompetition, managedJudokaScope, "Accès refusé à cette compétition.");

    let filtered = [];
    if (access.kind === "OWN") {
      filtered = await combatsRepository.listByCompetitionAndJudoka(idCompetition, access.judokaId);
    } else if (access.kind === "MANAGED") {
      const managedJudokaIds = access.managedJudokaScope.toIds();
      filtered = await combatsRepository.listByCompetitionAndJudokaIds(idCompetition, managedJudokaIds);
    } else {
      filtered = await combatsRepository.listByCompetition(idCompetition);
    }

    const judokas = access.kind === "OWN" ? [] : userContext.judokas;
    const judokasById = new Map(judokas.map(j => [String(j.id_judoka), j]));
    const enriched = filtered.map(combat => {
      const judoka = judokasById.get(String(combat.id_judoka));
      return {
        ...combat,
        judoka_nom: judoka ? `${judoka.prenom} ${normalizeLastName(judoka.nom)}` : combat.id_judoka
      };
    });

    return {
      competition: competitionRecord,
      combats: enriched,
      isAdmin: access.kind === "ALL",
      isParent: access.kind === "MANAGED",
      canManageCompetition: canManageCompetition(domainUser, domainCompetition, managedJudokaScope),
      canEditCompetition: canManageCompetition(domainUser, domainCompetition, managedJudokaScope),
      judokas
    };
  }

  async function saveCompetition(email, competition) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const domainUser = toDomainJudoka(user);
    const managedJudokaScope = userContext.managedJudokaScope;
    const domainCompetitionInput = toDomainCompetition(competition);
    const ownerJudokaId = resolveCompetitionOwnerId(domainUser, domainCompetitionInput, managedJudokaScope);
    const competitionDraft = createCompetition(domainCompetitionInput, ownerJudokaId);

    const competitionId = competition.competitionId || competition.id_competition;

    if (competitionId) {
      const existingCompetition = await competitionsRepository.getById(competitionId);
      if (!existingCompetition) throw new Error("Compétition introuvable.");
      assertCanManageCompetition(
        domainUser,
        toDomainCompetition(existingCompetition),
        managedJudokaScope,
        "Modification de cette compétition non autorisée."
      );

      await competitionsRepository.update(competitionId, competitionDraft);
      return {
        success: true,
        id_competition: competitionId,
        message: "Compétition modifiée."
      };
    }

    const idCompetition = buildCompetitionId();
    await competitionsRepository.insert(competitionDraft, idCompetition);

    return {
      success: true,
      id_competition: idCompetition,
      message: "Compétition créée."
    };
  }

  async function deleteCompetition(email, idCompetition) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const domainUser = toDomainJudoka(user);
    const managedJudokaScope = userContext.managedJudokaScope;

    if (!idCompetition) throw new Error("Compétition obligatoire.");

    const competition = await competitionsRepository.getById(idCompetition);
    if (!competition) throw new Error("Compétition introuvable.");
    assertCanManageCompetition(
      domainUser,
      toDomainCompetition(competition),
      managedJudokaScope,
      "Suppression de cette compétition non autorisée."
    );

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
