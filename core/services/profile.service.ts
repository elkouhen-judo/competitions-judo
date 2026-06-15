import {
  toCanonicalCombat,
  toCanonicalCompetition,
  toCanonicalJudoka
} from "./domain-adapters";
import type { buildJudokaProfileSnapshot } from "../domain/season-statistics";
import type { CombatsRepository } from "../repositories/combats.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { Competition, Judoka, JudokaProfile, RpcMethods } from "../types";
import type { UserContextService } from "./user-context.service";

type ProfileMethods = Pick<RpcMethods, "getJudokaProfile">;

export interface ProfileServiceDeps {
  combatsRepository: CombatsRepository;
  competitionsRepository: CompetitionsRepository;
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
    buildJudokaProfileSnapshot,
    userContextService,
    getCompetitionCategoryLabel,
    getCurrentSeasonBounds,
    isDateWithinSeason
  } = deps;

  async function getJudokaProfile(email: string, idJudoka?: string): Promise<JudokaProfile> {
    const { target } = await userContextService.getAccessibleJudokaProfile(email, idJudoka);
    const competitions = await competitionsRepository.listByJudoka(target.id_judoka);
    const combats = await combatsRepository.listByJudoka(target.id_judoka);
    const snapshot = buildJudokaProfileSnapshot({
      judoka: toCanonicalJudoka(target),
      competitions: competitions.map(toCanonicalCompetition),
      combats: combats.map(toCanonicalCombat),
      getCompetitionCategoryLabel,
      getCurrentSeasonBounds,
      isDateWithinSeason
    });

    return {
      ...snapshot,
      judoka: toCanonicalJudoka(target)
    };
  }

  return {
    methods: {
      getJudokaProfile
    }
  };
}
