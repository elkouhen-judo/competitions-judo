const {
  toCombatReadModelsWithJudokas,
  toCompetitionReadModel,
  toDomainCompetition,
  toDomainJudoka,
  toJudokaReadModel
} = require("./domain-adapters");

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
    let records = [];

    if (access.kind === "ALL") {
      records = await competitionsRepository.listAll();
    } else if (access.kind === "MANAGED") {
      const managedJudokaIds = access.managedJudokaScope.toIds();
      if (!managedJudokaIds.length) return [];
      records = await competitionsRepository.listByJudokaIds(managedJudokaIds);
    } else {
      records = await competitionsRepository.listByJudoka(access.judokaId);
    }

    return records.map(toCompetitionReadModel);
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

    const judokas = access.kind === "OWN" ? [] : userContext.judokas.map(toJudokaReadModel);
    const enriched = toCombatReadModelsWithJudokas(filtered, judokas, {
      formatJudokaDisplayName: judoka => `${judoka.firstName} ${normalizeLastName(judoka.lastName)}`
    });

    return {
      competition: toCompetitionReadModel(competitionRecord),
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

    const competitionId = domainCompetitionInput.competitionId;

    if (competitionId) {
      const existingCompetition = await competitionsRepository.getById(competitionId);
      if (!existingCompetition) throw new Error("Compétition introuvable.");
      assertCanManageCompetition(
        domainUser,
        toDomainCompetition(existingCompetition),
        managedJudokaScope,
        "Modification de cette compétition non autorisée."
      );

      domainCompetitionInput.seasonResult = toDomainCompetition(existingCompetition).seasonResult;
      const competitionDraft = createCompetition(domainCompetitionInput, ownerJudokaId);
      await competitionsRepository.update(competitionId, competitionDraft);
      return {
        success: true,
        competitionId,
        message: "Compétition modifiée."
      };
    }

    const idCompetition = buildCompetitionId();
    const competitionDraft = createCompetition(domainCompetitionInput, ownerJudokaId);
    await competitionsRepository.insert(competitionDraft, idCompetition);

    return {
      success: true,
      competitionId: idCompetition,
      message: "Compétition créée."
    };
  }

  async function finalizeCompetition(email, idCompetition, seasonResult) {
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
      "Finalisation de cette compétition non autorisée."
    );

    await competitionsRepository.updateSeasonResult(idCompetition, String(seasonResult || "").trim());
    return {
      success: true,
      competitionId: idCompetition,
      message: "Classement enregistré."
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
      finalizeCompetition,
      getCompetitionDetail,
      saveCompetition
    }
  };
};
