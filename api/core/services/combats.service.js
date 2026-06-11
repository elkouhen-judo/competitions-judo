module.exports = function createCombatsService(deps) {
  const {
    combatsRepository,
    userContextService,
    canManageCombatFor,
    buildCombatId
  } = deps;

  async function ajouterCombat(email, combat) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const managedJudokaIds = userContext.managedJudokaIds || [];

    if (!combat.id_competition) throw new Error("Compétition obligatoire.");
    if (!combat.resultat) throw new Error("Résultat obligatoire.");
    if (!combat.id_judoka) throw new Error("Judoka obligatoire.");

    if (!canManageCombatFor(user, combat.id_judoka, managedJudokaIds)) {
      throw new Error("Ajout de ce combat non autorisé.");
    }

    await combatsRepository.insert({
      id_combat: buildCombatId(),
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
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const managedJudokaIds = userContext.managedJudokaIds || [];

    if (!combat.id_combat) throw new Error("Combat obligatoire.");
    if (!combat.resultat) throw new Error("Résultat obligatoire.");
    if (!combat.id_judoka) throw new Error("Judoka obligatoire.");

    const existingCombat = await combatsRepository.getById(combat.id_combat);
    if (!existingCombat) throw new Error("Combat introuvable.");
    if (!canManageCombatFor(user, existingCombat.id_judoka, managedJudokaIds)) {
      throw new Error("Modification de ce combat non autorisée.");
    }
    if (!canManageCombatFor(user, combat.id_judoka, managedJudokaIds)) {
      throw new Error("Modification de ce combat non autorisée.");
    }

    await combatsRepository.update(combat.id_combat, {
      id_judoka: combat.id_judoka,
      id_competition: combat.id_competition,
      adversaire: combat.adversaire || "",
      resultat: combat.resultat,
      type_victoire: combat.type_victoire || "",
      deroule: combat.deroule || ""
    });

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
