const {
  toCombatReadModelsWithJudokas,
  toCanonicalCompetition,
  toCanonicalJudoka
} = require("./domain-adapters");

module.exports = function createCompetitionsService(deps) {
  const {
    combatsRepository,
    competitionsRepository,
    userContextService,
    normalizeLastName,
    canManageCompetition,
    assertCanAccessCompetition,
    assertCanManageCompetition,
    resolveJudokaDataAccess,
    resolveCompetitionOwnerId,
    buildCompetitionId,
    createCompetition,
    createPersistedCompetition
  } = deps;

  async function getCompetitionsForUser(user, managedJudokaScope) {
    const domainUser = toCanonicalJudoka(user);
    const access = resolveJudokaDataAccess(domainUser, managedJudokaScope);
    let records;

    if (access.isAll()) {
      records = await competitionsRepository.listAll();
    } else {
      const visibleJudokaIds = access.visibleJudokaIds();
      if (!visibleJudokaIds.length) return [];
      records =
        visibleJudokaIds.length === 1
          ? await competitionsRepository.listByJudoka(visibleJudokaIds[0])
          : await competitionsRepository.listByJudokaIds(visibleJudokaIds);
    }

    return records.map(toCanonicalCompetition);
  }

  async function getCompetitionDetail(email, idCompetition) {
    const {
      judokas: contextJudokas,
      managedJudokaScope,
      domainUser
    } = await userContextService.getDomainUserContext(email);
    const access = resolveJudokaDataAccess(domainUser, managedJudokaScope);
    const competitionRecord = await competitionsRepository.getById(idCompetition);

    if (!competitionRecord) {
      throw new Error("Compétition introuvable.");
    }
    const domainCompetition = toCanonicalCompetition(competitionRecord);

    assertCanAccessCompetition(
      domainUser,
      domainCompetition,
      managedJudokaScope,
      "Accès refusé à cette compétition."
    );

    let filtered;
    if (access.isAll()) {
      filtered = await combatsRepository.listByCompetition(idCompetition);
    } else {
      const visibleJudokaIds = access.visibleJudokaIds();
      filtered =
        visibleJudokaIds.length === 1
          ? await combatsRepository.listByCompetitionAndJudoka(idCompetition, visibleJudokaIds[0])
          : await combatsRepository.listByCompetitionAndJudokaIds(idCompetition, visibleJudokaIds);
    }

    const judokas = access.isOwn() ? [] : contextJudokas.map(toCanonicalJudoka);
    const enriched = toCombatReadModelsWithJudokas(filtered, judokas, {
      formatJudokaDisplayName: (judoka) =>
        `${judoka.firstName} ${normalizeLastName(judoka.lastName)}`
    });

    return {
      competition: toCanonicalCompetition(competitionRecord),
      combats: enriched,
      isAdmin: domainUser.accessRole === "ADMIN",
      isCoach: domainUser.accessRole === "COACH",
      isParent: access.isManaged(),
      canManageCompetition: canManageCompetition(domainUser, domainCompetition, managedJudokaScope),
      canEditCompetition: canManageCompetition(domainUser, domainCompetition, managedJudokaScope),
      judokas
    };
  }

  async function saveCompetition(email, competition) {
    const { managedJudokaScope, domainUser } = await userContextService.getDomainUserContext(email);
    const domainCompetitionInput = toCanonicalCompetition(competition);
    const ownerJudokaId = resolveCompetitionOwnerId(
      domainUser,
      domainCompetitionInput,
      managedJudokaScope
    );

    const competitionId = domainCompetitionInput.competitionId;

    if (competitionId) {
      const existingCompetition = await competitionsRepository.getById(competitionId);
      if (!existingCompetition) throw new Error("Compétition introuvable.");
      assertCanManageCompetition(
        domainUser,
        toCanonicalCompetition(existingCompetition),
        managedJudokaScope,
        "Modification de cette compétition non autorisée."
      );

      const existingDomainCompetition = toCanonicalCompetition(existingCompetition);
      const competitionDraft = createPersistedCompetition(existingDomainCompetition).changeDetails({
        ...domainCompetitionInput,
        ownerJudokaId
      });
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

  async function finalizeCompetition(email, idCompetition, result) {
    const { managedJudokaScope, domainUser } = await userContextService.getDomainUserContext(email);

    if (!idCompetition) throw new Error("Compétition obligatoire.");

    const competition = await competitionsRepository.getById(idCompetition);
    if (!competition) throw new Error("Compétition introuvable.");
    assertCanManageCompetition(
      domainUser,
      toCanonicalCompetition(competition),
      managedJudokaScope,
      "Finalisation de cette compétition non autorisée."
    );

    const finalization = createPersistedCompetition(toCanonicalCompetition(competition)).finalize(
      result
    );
    await competitionsRepository.updateResult(idCompetition, finalization);
    return {
      success: true,
      competitionId: idCompetition,
      message: "Classement enregistré."
    };
  }

  async function deleteCompetition(email, idCompetition) {
    const { managedJudokaScope, domainUser } = await userContextService.getDomainUserContext(email);

    if (!idCompetition) throw new Error("Compétition obligatoire.");

    const competition = await competitionsRepository.getById(idCompetition);
    if (!competition) throw new Error("Compétition introuvable.");
    assertCanManageCompetition(
      domainUser,
      toCanonicalCompetition(competition),
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
