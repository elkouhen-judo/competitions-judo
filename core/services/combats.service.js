const { toCanonicalCombat, toCanonicalCompetition, toCanonicalJudoka } = require("./domain-adapters");

module.exports = function createCombatsService(deps) {
  const {
    combatsRepository,
    competitionsRepository,
    userContextService,
    assertCanManageCombatFor,
    createCombatUpdate,
    createPersistedCompetition,
    buildCombatId
  } = deps;

  async function ajouterCombat(email, combat) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const domainUser = toCanonicalJudoka(user);
    const managedJudokaScope = userContext.managedJudokaScope;
    const domainCombat = toCanonicalCombat(combat);
    const judokaId = domainCombat.judokaId;
    const competitionId = domainCombat.competitionId;

    assertCanManageCombatFor(domainUser, judokaId, managedJudokaScope, "Ajout de ce combat non autorisé.");

    const competitionRecord = await competitionsRepository.getById(competitionId);
    if (!competitionRecord) throw new Error("Compétition introuvable.");
    const competition = createPersistedCompetition(toCanonicalCompetition(competitionRecord));
    const combatDraft = competition.recordCombat(domainCombat);

    await combatsRepository.insert(combatDraft, buildCombatId());

    return { success: true, message: "Combat ajouté." };
  }

  async function updateCombat(email, combat) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const domainUser = toCanonicalJudoka(user);
    const managedJudokaScope = userContext.managedJudokaScope;
    const domainCombat = toCanonicalCombat(combat);
    const combatId = domainCombat.combatId;
    const judokaId = domainCombat.judokaId;
    const competitionId = domainCombat.competitionId;
    const existingCombat = await combatsRepository.getById(combatId);
    if (!existingCombat) throw new Error("Combat introuvable.");
    assertCanManageCombatFor(
      domainUser,
      toCanonicalCombat(existingCombat).judokaId,
      managedJudokaScope,
      "Modification de ce combat non autorisée."
    );
    assertCanManageCombatFor(domainUser, judokaId, managedJudokaScope, "Modification de ce combat non autorisée.");

    createCombatUpdate(domainCombat);
    const competitionRecord = await competitionsRepository.getById(competitionId);
    if (!competitionRecord) throw new Error("Compétition introuvable.");
    const competition = createPersistedCompetition(toCanonicalCompetition(competitionRecord));
    const combatDraft = competition.recordCombat(domainCombat);

    await combatsRepository.update(combatId, combatDraft);

    return { success: true, message: "Combat modifié." };
  }

  async function deleteCombat(email, idCombat) {
    const userContext = await userContextService.getCurrentUserContext(email);
    const user = userContext.user;
    const domainUser = toCanonicalJudoka(user);
    const managedJudokaScope = userContext.managedJudokaScope;

    if (!idCombat) throw new Error("Combat obligatoire.");

    const combat = await combatsRepository.getById(idCombat);
    if (!combat) throw new Error("Combat introuvable.");
    assertCanManageCombatFor(
      domainUser,
      toCanonicalCombat(combat).judokaId,
      managedJudokaScope,
      "Suppression de ce combat non autorisée."
    );

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
