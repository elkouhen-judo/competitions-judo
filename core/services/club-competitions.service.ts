import { toCanonicalCompetition, toCanonicalJudoka } from "./domain-adapters";
import type { createClubCompetition, ClubCompetitionInput } from "../domain/competitions/club-competition";
import type { createCompetition } from "../domain/competitions/competition";
import type { ClubCompetitionsRepository } from "../repositories/club-competitions.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { JudokasRepository } from "../repositories/judokas.repository";
import type { JudokaRow } from "../repositories/types";
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
  userContextService: UserContextService;
  canManageClubCompetition: (user: ReturnType<typeof toCanonicalJudoka> | null | undefined) => boolean;
  buildClubCompetitionId: () => string;
  buildCompetitionId: () => string;
  createClubCompetition: typeof createClubCompetition;
  createCompetition: typeof createCompetition;
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
    userContextService,
    canManageClubCompetition,
    buildClubCompetitionId,
    buildCompetitionId,
    createClubCompetition,
    createCompetition
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

  function assertParticipantsMatchAgeCategory(rows: JudokaRow[], ageCategory: string): void {
    if (!ageCategory) {
      return;
    }

    const invalid = rows.filter((row) => String(row.categorie_age || "") !== ageCategory);
    if (invalid.length) {
      throw new Error("Tous les judokas sélectionnés doivent appartenir à la catégorie d'âge de la compétition.");
    }
  }

  async function saveClubCompetition(email: string, input: ClubCompetitionInput) {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    assertCanManage(domainUser);

    const isEditing = Boolean(input.clubCompetitionId);
    const clubCompetitionId = String(input.clubCompetitionId || buildClubCompetitionId());

    const participantJudokaIds =
      Array.isArray(input.participantJudokaIds) && input.participantJudokaIds.length
        ? input.participantJudokaIds
        : undefined;

    const event = createClubCompetition({ ...input, clubCompetitionId, participantJudokaIds });

    if (!isEditing && !event.participantJudokaIds.length) {
      throw new Error("Au moins un judoka doit être sélectionné.");
    }
    if (event.participantJudokaIds.length) {
      const participantRows = await assertParticipantIdsExist(event.participantJudokaIds);
      assertParticipantsMatchAgeCategory(participantRows, event.ageCategory);
    }

    if (isEditing) {
      await clubCompetitionsRepository.update(clubCompetitionId, event);
    } else {
      await clubCompetitionsRepository.insert(event);
    }

    const existing = isEditing
      ? await competitionsRepository.listByClubCompetition(clubCompetitionId)
      : [];
    const existingJudokaIds = new Set(existing.map((row) => String(row.id_judoka)));

    for (const judokaId of event.participantJudokaIds) {
      if (existingJudokaIds.has(String(judokaId))) {
        continue;
      }
      const competition = createCompetition(
        {
          name: event.name,
          competitionDate: event.competitionDate,
          ageCategory: event.ageCategory,
          weightCategory: event.weightCategory,
          clubCompetitionId
        },
        judokaId
      );
      await competitionsRepository.insert(competition, buildCompetitionId());
    }

    return {
      success: true,
      clubCompetitionId,
      message: input.clubCompetitionId ? "Compétition club modifiée." : "Compétition club créée."
    };
  }

  async function getClubCompetitionDetail(email: string, idClubCompetition: string) {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    assertCanManage(domainUser);
    const event = await clubCompetitionsRepository.getById(idClubCompetition);
    if (!event) {
      throw new Error("Compétition club introuvable.");
    }
    const participations = await competitionsRepository.listByClubCompetition(idClubCompetition);
    const judokas = await judokasRepository.listByIds(participations.map((row) => row.id_judoka));
    return {
      clubCompetition: event,
      participations: participations.map(toCanonicalCompetition),
      judokas: judokas.map(toCanonicalJudoka)
    };
  }

  async function deleteClubCompetition(email: string, idClubCompetition: string) {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    assertCanManage(domainUser);
    const event = await clubCompetitionsRepository.getById(idClubCompetition);
    if (!event) {
      throw new Error("Compétition club introuvable.");
    }
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

  async function detachClubCompetitionParticipant(
    email: string,
    idClubCompetition: string,
    idCompetition: string
  ) {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    assertCanManage(domainUser);
    const event = await clubCompetitionsRepository.getById(idClubCompetition);
    if (!event) {
      throw new Error("Compétition club introuvable.");
    }
    const participation = await competitionsRepository.getById(idCompetition);
    if (
      !participation ||
      String(participation.club_competition_id || "") !== String(idClubCompetition)
    ) {
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
}
