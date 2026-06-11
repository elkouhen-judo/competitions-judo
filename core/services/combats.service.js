module.exports = function createCombatsService(deps) {
  const {
    combatsRepository,
    competitionsRepository,
    userContextService,
    assertCompetitionCanContainCombat,
    canManageCombatFor,
    createCombat,
    updateCombatRecord,
    buildCombatId
  } = deps;

  async function ajouterCombat(email, combat) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const managedJudokaIds = userContext.managedJudokaIds || [];

    if (!canManageCombatFor(user, combat.id_judoka, managedJudokaIds)) {
      throw new Error("Ajout de ce combat non autorisé.");
    }

    const combatDraft = createCombat(combat);
    const competition = await competitionsRepository.getById(combatDraft.id_competition);
    if (!competition) throw new Error("Compétition introuvable.");
    assertCompetitionCanContainCombat(competition, combatDraft);

    await combatsRepository.insert(combatDraft.toNewRecord(buildCombatId));

    return { success: true, message: "Combat ajouté." };
  }

  async function updateCombat(email, combat) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const managedJudokaIds = userContext.managedJudokaIds || [];

    const existingCombat = await combatsRepository.getById(combat.id_combat);
    if (!existingCombat) throw new Error("Combat introuvable.");
    if (!canManageCombatFor(user, existingCombat.id_judoka, managedJudokaIds)) {
      throw new Error("Modification de ce combat non autorisée.");
    }
    if (!canManageCombatFor(user, combat.id_judoka, managedJudokaIds)) {
      throw new Error("Modification de ce combat non autorisée.");
    }

    const combatDraft = updateCombatRecord(combat);
    const competition = await competitionsRepository.getById(combatDraft.id_competition);
    if (!competition) throw new Error("Compétition introuvable.");
    assertCompetitionCanContainCombat(competition, {
      id_combat: combat.id_combat,
      ...combatDraft
    });

    await combatsRepository.update(combat.id_combat, combatDraft);

    return { success: true, message: "Combat modifié." };
  }

  async function deleteCombat(email, idCombat) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const managedJudokaIds = userContext.managedJudokaIds || [];

    if (!idCombat) throw new Error("Combat obligatoire.");

    const combat = await combatsRepository.getById(idCombat);
    if (!combat) throw new Error("Combat introuvable.");
    if (!canManageCombatFor(user, combat.id_judoka, managedJudokaIds)) {
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
