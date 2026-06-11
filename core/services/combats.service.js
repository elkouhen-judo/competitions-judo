module.exports = function createCombatsService(deps) {
  const {
    combatsRepository,
    competitionsRepository,
    userContextService,
    canManageCombatFor,
    createCombatUpdate,
    createPersistedCompetition,
    buildCombatId
  } = deps;

  async function ajouterCombat(email, combat) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const managedJudokaScope = userContext.managedJudokaScope || userContext.managedJudokaIds || [];

    const judokaId = combat.judokaId || combat.id_judoka;
    const competitionId = combat.competitionId || combat.id_competition;

    if (!canManageCombatFor(user, judokaId, managedJudokaScope)) {
      throw new Error("Ajout de ce combat non autorisé.");
    }

    const competitionRecord = await competitionsRepository.getById(competitionId);
    if (!competitionRecord) throw new Error("Compétition introuvable.");
    const competition = createPersistedCompetition(competitionRecord);
    const combatDraft = competition.recordCombat(combat);

    await combatsRepository.insert(combatDraft, buildCombatId());

    return { success: true, message: "Combat ajouté." };
  }

  async function updateCombat(email, combat) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const managedJudokaScope = userContext.managedJudokaScope || userContext.managedJudokaIds || [];

    const combatId = combat.combatId || combat.id_combat;
    const judokaId = combat.judokaId || combat.id_judoka;
    const competitionId = combat.competitionId || combat.id_competition;
    const existingCombat = await combatsRepository.getById(combatId);
    if (!existingCombat) throw new Error("Combat introuvable.");
    if (!canManageCombatFor(user, existingCombat.id_judoka, managedJudokaScope)) {
      throw new Error("Modification de ce combat non autorisée.");
    }
    if (!canManageCombatFor(user, judokaId, managedJudokaScope)) {
      throw new Error("Modification de ce combat non autorisée.");
    }

    createCombatUpdate(combat);
    const competitionRecord = await competitionsRepository.getById(competitionId);
    if (!competitionRecord) throw new Error("Compétition introuvable.");
    const competition = createPersistedCompetition(competitionRecord);
    const combatDraft = competition.recordCombat(combat);

    await combatsRepository.update(combatId, combatDraft);

    return { success: true, message: "Combat modifié." };
  }

  async function deleteCombat(email, idCombat) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const managedJudokaScope = userContext.managedJudokaScope || userContext.managedJudokaIds || [];

    if (!idCombat) throw new Error("Combat obligatoire.");

    const combat = await combatsRepository.getById(idCombat);
    if (!combat) throw new Error("Combat introuvable.");
    if (!canManageCombatFor(user, combat.id_judoka, managedJudokaScope)) {
      throw new Error("Suppression de ce combat non autorisée.");
    }

    await combatsRepository.remove(idCombat);
    return { success: true, message: "Combat supprimé." };
  }

  return {
    methods: {
      ajouterCombat,
      deleteCombat,
      updateCombat
    }
  };
};
