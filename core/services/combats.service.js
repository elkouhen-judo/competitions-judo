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

    if (!canManageCombatFor(user, combat.id_judoka, managedJudokaScope)) {
      throw new Error("Ajout de ce combat non autorisé.");
    }

    const competitionRecord = await competitionsRepository.getById(combat.id_competition);
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

    const existingCombat = await combatsRepository.getById(combat.id_combat);
    if (!existingCombat) throw new Error("Combat introuvable.");
    if (!canManageCombatFor(user, existingCombat.id_judoka, managedJudokaScope)) {
      throw new Error("Modification de ce combat non autorisée.");
    }
    if (!canManageCombatFor(user, combat.id_judoka, managedJudokaScope)) {
      throw new Error("Modification de ce combat non autorisée.");
    }

    createCombatUpdate(combat);
    const competitionRecord = await competitionsRepository.getById(combat.id_competition);
    if (!competitionRecord) throw new Error("Compétition introuvable.");
    const competition = createPersistedCompetition(competitionRecord);
    const combatDraft = competition.recordCombat(combat);

    await combatsRepository.update(combat.id_combat, combatDraft);

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
