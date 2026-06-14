const {
  toCanonicalJudoka,
  toCompetitionReadModel,
  toJudokaReadModel
} = require("./domain-adapters");

module.exports = function createClubCompetitionsService(deps) {
  const {
    clubCompetitionsRepository,
    competitionsRepository,
    judokasRepository,
    userContextService,
    canManageClubCompetition,
    buildClubCompetitionId,
    buildCompetitionId,
    createClubCompetition,
    createCompetition
  } = deps;

  function assertCanManage(user) {
    if (!canManageClubCompetition(toCanonicalJudoka(user))) {
      throw new Error("Gestion des compétitions club réservée aux coachs.");
    }
  }

  async function assertParticipantIdsExist(ids) {
    const rows = await judokasRepository.listByIds(ids);
    const found = new Set(rows.map(row => String(row.id_judoka)));
    const missing = ids.filter(id => !found.has(String(id)));
    if (missing.length) {
      throw new Error("Judoka participant introuvable.");
    }
    return rows;
  }

  async function saveClubCompetition(email, input) {
    const userContext = await userContextService.getCurrentUserContext(email);
    assertCanManage(userContext.user);

    const clubCompetitionId = input.clubCompetitionId || buildClubCompetitionId();
    const event = createClubCompetition({ ...input, clubCompetitionId });
    if (!event.participantJudokaIds.length) {
      throw new Error("Au moins un judoka doit être sélectionné.");
    }
    await assertParticipantIdsExist(event.participantJudokaIds);

    if (input.clubCompetitionId) {
      await clubCompetitionsRepository.update(clubCompetitionId, event);
    } else {
      await clubCompetitionsRepository.insert(event);
    }

    const existing = input.clubCompetitionId
      ? await competitionsRepository.listByClubCompetition(clubCompetitionId)
      : [];
    const existingJudokaIds = new Set(existing.map(row => String(row.id_judoka)));

    for (const judokaId of event.participantJudokaIds) {
      if (existingJudokaIds.has(String(judokaId))) continue;
      const competition = createCompetition({
        name: event.name,
        competitionDate: event.competitionDate,
        ageCategory: event.ageCategory,
        weightCategory: event.weightCategory,
        clubCompetitionId
      }, judokaId);
      await competitionsRepository.insert(competition, buildCompetitionId());
    }

    return {
      success: true,
      clubCompetitionId,
      message: input.clubCompetitionId ? "Compétition club modifiée." : "Compétition club créée."
    };
  }

  async function getClubCompetitionDetail(email, idClubCompetition) {
    const userContext = await userContextService.getCurrentUserContext(email);
    assertCanManage(userContext.user);
    const event = await clubCompetitionsRepository.getById(idClubCompetition);
    if (!event) throw new Error("Compétition club introuvable.");
    const participations = await competitionsRepository.listByClubCompetition(idClubCompetition);
    const judokas = await judokasRepository.listByIds(participations.map(row => row.id_judoka));
    return {
      clubCompetition: event,
      participations: participations.map(toCompetitionReadModel),
      judokas: judokas.map(toJudokaReadModel)
    };
  }

  async function detachClubCompetitionParticipant(email, idClubCompetition, idCompetition) {
    const userContext = await userContextService.getCurrentUserContext(email);
    assertCanManage(userContext.user);
    const event = await clubCompetitionsRepository.getById(idClubCompetition);
    if (!event) throw new Error("Compétition club introuvable.");
    const participation = await competitionsRepository.getById(idCompetition);
    if (!participation || String(participation.club_competition_id || "") !== String(idClubCompetition)) {
      throw new Error("Participation introuvable.");
    }
    await competitionsRepository.detachFromClubCompetition(idCompetition);
    return {
      success: true,
      message: "La participation a été retirée de la compétition club sans supprimer ses résultats."
    };
  }

  return {
    methods: {
      detachClubCompetitionParticipant,
      getClubCompetitionDetail,
      saveClubCompetition
    }
  };
};
