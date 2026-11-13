import { formatSeasonLabel, getSeasonStartYear, isRegisteredForCompetitionDate } from "../domain/season";
import { toCanonicalCompetition, toCanonicalJudoka } from "./domain-adapters";
import type { createClubCompetition, ClubCompetitionInput } from "../domain/competitions/club-competition";
import type { createCompetition } from "../domain/competitions/competition";
import type { ClubCompetitionsRepository } from "../repositories/club-competitions.repository";
import type { CombatsRepository } from "../repositories/combats.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { JudokasRepository } from "../repositories/judokas.repository";
import type { ClubCompetitionRow, CompetitionRow, JudokaRow } from "../repositories/types";
import { countCombatResults } from "../domain/competition-results";
import type { RpcMethods } from "../types";
import type { UserContextService } from "./user-context.service";

type ClubCompetitionMethods = Pick<
  RpcMethods,
  | "deleteClubCompetition"
  | "detachClubCompetitionParticipant"
  | "getClubCompetitionDetail"
  | "saveClubCompetition"
>;

export interface ClubCompetitionsServiceDeps {
  clubCompetitionsRepository: ClubCompetitionsRepository;
  competitionsRepository: CompetitionsRepository;
  judokasRepository: JudokasRepository;
  /** Facultatif : permet d'afficher le bilan des combats saisis par participant. */
  combatsRepository?: Pick<CombatsRepository, "listByCompetitionIds">;
  userContextService: UserContextService;
  canManageClubCompetition: (user: ReturnType<typeof toCanonicalJudoka> | null | undefined) => boolean;
  buildClubCompetitionId: () => string;
  buildCompetitionId: () => string;
  createClubCompetition: typeof createClubCompetition;
  createCompetition: typeof createCompetition;
  getCurrentDate?: () => string;
}

export interface ClubCompetitionsService {
  methods: ClubCompetitionMethods;
}

export default function createClubCompetitionsService(
  deps: ClubCompetitionsServiceDeps
): ClubCompetitionsService {
  const {
    clubCompetitionsRepository,
    competitionsRepository,
    judokasRepository,
    combatsRepository,
    userContextService,
    canManageClubCompetition,
    buildClubCompetitionId,
    buildCompetitionId,
    createClubCompetition,
    createCompetition,
    getCurrentDate = () => new Date().toISOString().slice(0, 10)
  } = deps;

  function assertCanManage(domainUser: ReturnType<typeof toCanonicalJudoka>): void {
    if (!canManageClubCompetition(domainUser)) {
      throw new Error("Gestion des compétitions club réservée aux coachs.");
    }
  }

  async function assertParticipantIdsExist(ids: string[]): Promise<JudokaRow[]> {
    const rows = await judokasRepository.listByIds(ids);
    const found = new Set(rows.map((row) => String(row.id_judoka)));
    const missing = ids.filter((id) => !found.has(String(id)));
    if (missing.length) {
      throw new Error("Judoka participant introuvable.");
    }
    return rows;
  }

  // Une compétition club n'est visible et modifiable que par les coachs de son club.
  // Une compétition club d'un autre club (ou sans club) est traitée comme introuvable.
  function assertClubAccessible(clubId: unknown, coachClubIds: string[]): string {
    const id = String(clubId || "");
    if (!id || !coachClubIds.includes(id)) {
      throw new Error("Compétition club introuvable.");
    }
    return id;
  }

  async function getAccessibleEvent(idClubCompetition: string, coachClubIds: string[]) {
    const event = await clubCompetitionsRepository.getById(idClubCompetition);
    if (!event) {
      throw new Error("Compétition club introuvable.");
    }
    assertClubAccessible(event.club_id, coachClubIds);
    return event;
  }

  function assertParticipantsInClub(rows: JudokaRow[], clubId: string): void {
    const outside = rows.filter((row) => String(row.club_id || "") !== clubId);
    if (outside.length) {
      throw new Error("Tous les judokas sélectionnés doivent appartenir au club de la compétition.");
    }
  }

  function assertParticipantsMatchAgeCategory(rows: JudokaRow[], ageCategory: string): void {
    const invalid = rows.filter((row) => String(row.categorie_age || "") !== ageCategory);
    if (invalid.length) {
      throw new Error("Tous les judokas sélectionnés doivent appartenir à la catégorie d'âge de la compétition.");
    }
  }

  // INSCR-2 : seuls les judokas inscrits pour la saison de la compétition peuvent y être ajoutés.
  function assertParticipantsRegistered(rows: JudokaRow[], competitionDate: string): void {
    const unregistered = rows.filter((row) => !isRegisteredForCompetitionDate(row.saison_inscription, competitionDate));
    if (unregistered.length) {
      const season = getSeasonStartYear(competitionDate) as number;
      throw new Error(
        `Tous les judokas sélectionnés doivent être inscrits pour la saison ${formatSeasonLabel(season)}.`
      );
    }
  }

  function isCompetitionFinished(row: { date?: unknown }): boolean {
    const date = String(row.date || "").trim();
    return Boolean(date) && date <= getCurrentDate();
  }

  async function saveClubCompetition(email: string, input: ClubCompetitionInput) {
    const { domainUser, coachClubIds = [] } = await userContextService.getDomainUserContext(email);
    assertCanManage(domainUser);

    const isEditing = Boolean(input.clubCompetitionId);
    const clubCompetitionId = String(input.clubCompetitionId || buildClubCompetitionId());
    // Le club d'une compétition est fixé à la création ; un coach d'un seul club n'a pas à le choisir.
    const requestedClubId = String(input.clubId || "") || (coachClubIds.length === 1 ? coachClubIds[0] : "");
    const [existingEvent, existing] = isEditing
      ? await Promise.all([
          getAccessibleEvent(clubCompetitionId, coachClubIds),
          competitionsRepository.listByClubCompetition(clubCompetitionId)
        ])
      : [null, []];
    const clubId = existingEvent ? existingEvent.club_id || "" : requestedClubId;
    if (!clubId) {
      throw new Error("Club de la compétition obligatoire.");
    }
    assertClubAccessible(clubId, coachClubIds);
    const existingJudokaIds = new Set(existing.map((row) => String(row.id_judoka)));

    // Saisie a posteriori : l'ajout de judokas reste possible après la date de la compétition.
    const participantJudokaIds =
      Array.isArray(input.participantJudokaIds) && input.participantJudokaIds.length
        ? input.participantJudokaIds
        : undefined;

    const event = createClubCompetition({ ...input, clubCompetitionId, participantJudokaIds, clubId });

    if (!isEditing && !event.participantJudokaIds.length) {
      throw new Error("Au moins un judoka doit être sélectionné.");
    }
    const allParticipantJudokaIds = [
      ...new Set([...existing.map((row) => String(row.id_judoka)), ...event.participantJudokaIds.map(String)])
    ];
    if (allParticipantJudokaIds.length) {
      const participantRows = await assertParticipantIdsExist(allParticipantJudokaIds);
      const newParticipantRows = participantRows.filter((row) => !existingJudokaIds.has(String(row.id_judoka)));
      assertParticipantsInClub(newParticipantRows, clubId);
      assertParticipantsRegistered(newParticipantRows, event.competitionDate);
      assertParticipantsMatchAgeCategory(participantRows, event.ageCategory);
    }

    if (isEditing) {
      await clubCompetitionsRepository.update(clubCompetitionId, event);
    } else {
      await clubCompetitionsRepository.insert(event);
    }

    // ECRIT-3 : les champs hérités se propagent en une requête, les créations partent en un envoi.
    const inheritedFields = {
      name: event.name,
      competitionDate: event.competitionDate,
      ageCategory: event.ageCategory,
      level: event.level
    };
    if (existing.length) {
      await competitionsRepository.updateClubCompetitionFields(clubCompetitionId, inheritedFields);
    }
    const created = await competitionsRepository.insertMany(
      event.participantJudokaIds
        .filter((judokaId) => !existingJudokaIds.has(String(judokaId)))
        .map((judokaId) => ({
          competition: createCompetition(
            { ...inheritedFields, weightCategory: "", clubCompetitionId },
            judokaId
          ),
          idCompetition: buildCompetitionId()
        }))
    );
    const updated: CompetitionRow[] = existing.map((participation) => ({
      ...participation,
      nom: event.name,
      date: event.competitionDate,
      categorie_age: event.ageCategory,
      niveau: event.level || ""
    }));

    return {
      success: true,
      clubCompetitionId,
      message: input.clubCompetitionId ? "Compétition club modifiée." : "Compétition club créée.",
      // ECRIT-2 : le navigateur met à jour son état sans recharger les données initiales.
      clubCompetition: {
        clubCompetitionId,
        name: event.name,
        competitionDate: event.competitionDate,
        clubId
      },
      competitions: [...updated, ...created].map(toCanonicalCompetition)
    };
  }

  async function getClubCompetitionDetail(email: string, idClubCompetition: string) {
    const { domainUser, coachClubIds = [] } = await userContextService.getDomainUserContext(email);
    assertCanManage(domainUser);
    const [event, participations]: [ClubCompetitionRow, CompetitionRow[]] = await Promise.all([
      getAccessibleEvent(idClubCompetition, coachClubIds),
      competitionsRepository.listByClubCompetition(idClubCompetition)
    ]);
    const [judokas, combats] = await Promise.all([
      judokasRepository.listByIds(participations.map((row) => row.id_judoka)),
      combatsRepository
        ? combatsRepository.listByCompetitionIds(participations.map((row) => row.id_competition))
        : []
    ]);
    const resultsByCompetitionId = new Map<string, string[]>();
    combats.forEach((combat) => {
      const key = String(combat.id_competition);
      resultsByCompetitionId.set(key, [...(resultsByCompetitionId.get(key) || []), combat.resultat]);
    });
    const combatRecords = Object.fromEntries(
      [...resultsByCompetitionId].map(([key, results]) => [key, countCombatResults(results)])
    );
    return {
      clubCompetition: event,
      participations: participations.map(toCanonicalCompetition),
      judokas: judokas.map(toCanonicalJudoka),
      combatRecords
    };
  }

  async function deleteClubCompetition(email: string, idClubCompetition: string) {
    const { domainUser, coachClubIds = [] } = await userContextService.getDomainUserContext(email);
    assertCanManage(domainUser);
    await getAccessibleEvent(idClubCompetition, coachClubIds);
    // ECRIT-3 : toutes les participations sont détachées en une requête.
    await competitionsRepository.detachAllFromClubCompetition(idClubCompetition);
    await clubCompetitionsRepository.remove(idClubCompetition);
    return {
      success: true,
      message: "Compétition club supprimée sans supprimer les compétitions et combats des judokas associés."
    };
  }

  async function detachClubCompetitionParticipant(
    email: string,
    idClubCompetition: string,
    idCompetition: string
  ) {
    const { domainUser, coachClubIds = [] } = await userContextService.getDomainUserContext(email);
    assertCanManage(domainUser);
    const event = await getAccessibleEvent(idClubCompetition, coachClubIds);
    const participation = await competitionsRepository.getById(idCompetition);
    if (
      !participation ||
      String(participation.club_competition_id || "") !== String(idClubCompetition)
    ) {
      throw new Error("Participation introuvable.");
    }
    if (isCompetitionFinished(event)) {
      // Compétition passée : on ne retire qu'une participation vide (ajout par erreur lors d'une
      // saisie a posteriori), jamais une participation qui porte des combats ou un classement.
      const combats = combatsRepository
        ? await combatsRepository.listByCompetitionIds([String(idCompetition)])
        : null;
      if (!combats || combats.length || String(participation.classement || "").trim()) {
        throw new Error(
          "Ce judoka a déjà des combats ou un classement saisis pour cette compétition passée : il ne peut pas être retiré."
        );
      }
      await competitionsRepository.remove(idCompetition);
      return {
        success: true,
        message: "La participation, sans combat ni classement, a été supprimée."
      };
    }
    await competitionsRepository.remove(idCompetition);
    return {
      success: true,
      message: "La participation a été supprimée car la compétition n'a pas encore eu lieu."
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
}
