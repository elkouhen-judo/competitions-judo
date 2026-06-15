const { toCanonicalJudoka, toCanonicalCompetition } = require("./domain-adapters");

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

  function assertCanManage(domainUser) {
    if (!canManageClubCompetition(domainUser)) {
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
    const { domainUser } = await userContextService.getDomainUserContext(email);
    assertCanManage(domainUser);

    const isEditing = Boolean(input.clubCompetitionId);
    const clubCompetitionId = input.clubCompetitionId || buildClubCompetitionId();

    // An empty array is truthy and would cause the domain to throw — normalize it to undefined
    const participantJudokaIds = Array.isArray(input.participantJudokaIds) && input.participantJudokaIds.length
      ? input.participantJudokaIds
      : undefined;

    const event = createClubCompetition({ ...input, clubCompetitionId, participantJudokaIds });

    if (!isEditing && !event.participantJudokaIds.length) {
      throw new Error("Au moins un judoka doit être sélectionné.");
    }
    if (event.participantJudokaIds.length) {
      await assertParticipantIdsExist(event.participantJudokaIds);
    }

    if (isEditing) {
      await clubCompetitionsRepository.update(clubCompetitionId, event);
    } else {
      await clubCompetitionsRepository.insert(event);
    }

    const existing = isEditing
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
    const { domainUser } = await userContextService.getDomainUserContext(email);
    assertCanManage(domainUser);
    const event = await clubCompetitionsRepository.getById(idClubCompetition);
    if (!event) throw new Error("Compétition club introuvable.");
    const participations = await competitionsRepository.listByClubCompetition(idClubCompetition);
    const judokas = await judokasRepository.listByIds(participations.map(row => row.id_judoka));
    return {
      clubCompetition: event,
      participations: participations.map(toCanonicalCompetition),
      judokas: judokas.map(toCanonicalJudoka)
    };
  }

  async function deleteClubCompetition(email, idClubCompetition) {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    assertCanManage(domainUser);
    const event = await clubCompetitionsRepository.getById(idClubCompetition);
    if (!event) throw new Error("Compétition club introuvable.");
    const participations = await competitionsRepository.listByClubCompetition(idClubCompetition);
    for (const participation of participations) {
      await competitionsRepository.remove(participation.id_competition);
    }
    await clubCompetitionsRepository.remove(idClubCompetition);
    return {
      success: true,
      message: "Compétition club supprimée avec les compétitions et combats des judokas associés."
    };
  }

  async function detachClubCompetitionParticipant(email, idClubCompetition, idCompetition) {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    assertCanManage(domainUser);
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
      deleteClubCompetition,
      detachClubCompetitionParticipant,
      getClubCompetitionDetail,
      saveClubCompetition
    }
  };
};
