import {
  toCanonicalCombat,
  toCanonicalCompetition,
  toCanonicalJudoka
} from "./domain-adapters";
import type { buildJudokaProfileSnapshot } from "../domain/season-statistics";
import type { CombatsRepository } from "../repositories/combats.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { JudokasRepository } from "../repositories/judokas.repository";
import type { Competition, Judoka, JudokaProfile, OperationResult, RpcMethods } from "../types";
import type { UserContextService } from "./user-context.service";

type ProfileMethods = Pick<RpcMethods, "getJudokaProfile" | "saveCoachNotes">;

export interface ProfileServiceDeps {
  combatsRepository: CombatsRepository;
  competitionsRepository: CompetitionsRepository;
  judokasRepository: JudokasRepository;
  buildJudokaProfileSnapshot: typeof buildJudokaProfileSnapshot;
  userContextService: UserContextService;
  getCompetitionCategoryLabel: (competition: Competition) => string;
  getCurrentSeasonBounds: (referenceDate?: Date) => { start: string; end: string; label: string };
  isDateWithinSeason: (dateValue: unknown, bounds: { start: string; end: string; label: string }) => boolean;
}

export interface ProfileService {
  methods: ProfileMethods;
}

export default function createProfileService(deps: ProfileServiceDeps): ProfileService {
  const {
    combatsRepository,
    competitionsRepository,
    judokasRepository,
    buildJudokaProfileSnapshot,
    userContextService,
    getCompetitionCategoryLabel,
    getCurrentSeasonBounds,
    isDateWithinSeason
  } = deps;

  async function getJudokaProfile(email: string, idJudoka?: string, seasonStartYear?: number): Promise<JudokaProfile> {
    const { user, target } = await userContextService.getAccessibleJudokaProfile(email, idJudoka);
    const competitions = await competitionsRepository.listByJudoka(target.id_judoka);
    const combats = await combatsRepository.listByJudoka(target.id_judoka);
    const seasonRefDate = seasonStartYear != null ? new Date(seasonStartYear, 9, 1) : undefined;
    const getPinnedSeasonBounds = seasonRefDate
      ? () => getCurrentSeasonBounds(seasonRefDate)
      : getCurrentSeasonBounds;
    const snapshot = buildJudokaProfileSnapshot({
      judoka: toCanonicalJudoka(target),
      competitions: competitions.map(toCanonicalCompetition),
      combats: combats.map(toCanonicalCombat),
      getCompetitionCategoryLabel,
      getCurrentSeasonBounds: getPinnedSeasonBounds,
      isDateWithinSeason
    });

    const isCoach = user.role === "COACH";
    return {
      ...snapshot,
      judoka: toCanonicalJudoka(target),
      ...(isCoach ? { coachNotes: target.notes_coach ?? "" } : {})
    };
  }

  async function saveCoachNotes(email: string, idJudoka: string, notes: string): Promise<OperationResult> {
    const { user } = await userContextService.getAccessibleJudokaProfile(email, idJudoka);
    if (user.role !== "COACH") {
      throw new Error("Accès non autorisé. Réservé au coach.");
    }
    await judokasRepository.saveCoachNotes(idJudoka, notes);
    return { success: true, message: "Notes enregistrées." };
  }

  return {
    methods: {
      getJudokaProfile,
      saveCoachNotes
    }
  };
}
