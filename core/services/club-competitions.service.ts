import { toCanonicalCompetition, toCanonicalJudoka } from "./domain-adapters";
import type { createClubCompetition, ClubCompetitionInput } from "../domain/competitions/club-competition";
import type { createCompetition } from "../domain/competitions/competition";
import type { ClubCompetitionsRepository } from "../repositories/club-competitions.repository";
import type { CombatsRepository } from "../repositories/combats.repository";
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

  function assertParticipantsMatchAgeCategory(rows: JudokaRow[], ageCategory: string): void {
    const invalid = rows.filter((row) => String(row.categorie_age || "") !== ageCategory);
    if (invalid.length) {
      throw new Error("Tous les judokas sélectionnés doivent appartenir à la catégorie d'âge de la compétition.");
    }
  }

  function isCompetitionFinished(row: { date?: unknown }): boolean {
    const date = String(row.date || "").trim();
    return Boolean(date) && date <= getCurrentDate();
  }

  async function saveClubCompetition(email: string, input: ClubCompetitionInput) {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    assertCanManage(domainUser);

    const isEditing = Boolean(input.clubCompetitionId);
    const clubCompetitionId = String(input.clubCompetitionId || buildClubCompetitionId());
    const existing = isEditing
      ? await competitionsRepository.listByClubCompetition(clubCompetitionId)
      : [];
    const existingJudokaIds = new Set(existing.map((row) => String(row.id_judoka)));

    // Saisie a posteriori : l'ajout de judokas reste possible après la date de la compétition.
    const participantJudokaIds =
      Array.isArray(input.participantJudokaIds) && input.participantJudokaIds.length
        ? input.participantJudokaIds
        : undefined;

    const event = createClubCompetition({ ...input, clubCompetitionId, participantJudokaIds });

    if (!isEditing && !event.participantJudokaIds.length) {
      throw new Error("Au moins un judoka doit être sélectionné.");
    }
    const allParticipantJudokaIds = [
      ...new Set([...existing.map((row) => String(row.id_judoka)), ...event.participantJudokaIds.map(String)])
    ];
    if (allParticipantJudokaIds.length) {
      const participantRows = await assertParticipantIdsExist(allParticipantJudokaIds);
      assertParticipantsMatchAgeCategory(participantRows, event.ageCategory);
    }

    if (isEditing) {
      await clubCompetitionsRepository.update(clubCompetitionId, event);
    } else {
      await clubCompetitionsRepository.insert(event);
    }

    for (const participation of existing) {
      const competition = createCompetition(
        {
          competitionId: participation.id_competition,
          clubCompetitionId,
          name: event.name,
          competitionDate: event.competitionDate,
          ageCategory: event.ageCategory,
          weightCategory: "",
          level: event.level,
          result: participation.classement || ""
        },
        participation.id_judoka
      );
      await competitionsRepository.update(participation.id_competition, competition);
    }

    for (const judokaId of event.participantJudokaIds) {
      if (existingJudokaIds.has(String(judokaId))) {
        continue;
      }
      const competition = createCompetition(
        {
          name: event.name,
          competitionDate: event.competitionDate,
          ageCategory: event.ageCategory,
          weightCategory: "",
          level: event.level,
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
    const combats = combatsRepository
      ? await combatsRepository.listByCompetitionIds(participations.map((row) => row.id_competition))
      : [];
    const combatRecords: Record<string, { total: number; wins: number; losses: number; draws: number }> = {};
    combats.forEach((combat) => {
      const key = String(combat.id_competition);
      const record = combatRecords[key] || { total: 0, wins: 0, losses: 0, draws: 0 };
      const result = String(combat.resultat || "");
      record.total += 1;
      if (result === "Victoire") record.wins += 1;
      else if (result === "Défaite") record.losses += 1;
      else if (result) record.draws += 1;
      combatRecords[key] = record;
    });
    return {
      clubCompetition: event,
      participations: participations.map(toCanonicalCompetition),
      judokas: judokas.map(toCanonicalJudoka),
      combatRecords
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
      await competitionsRepository.detachFromClubCompetition(participation.id_competition);
    }
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
