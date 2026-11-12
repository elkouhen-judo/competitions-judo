import {
  toCombatReadModelsWithJudokas,
  toCanonicalCompetition,
  toCanonicalJudoka
} from "./domain-adapters";
import type { createCompetition, createPersistedCompetition } from "../domain/competitions/competition";
import type { CombatsRepository } from "../repositories/combats.repository";
import { isConcededScoreRow, type CombatScoresRepository } from "../repositories/combat-scores.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { JudokaRow } from "../repositories/types";
import type { CombatSuggestions, Competition, CompetitionDetail, ManagedJudokaScope, RpcMethods } from "../types";
import type { UserContextService } from "./user-context.service";

interface JudokaDataAccess {
  isAll(): boolean;
  isManaged(): boolean;
  isOwn(): boolean;
  visibleJudokaIds(): string[];
}

type CompetitionMethods = Pick<
  RpcMethods,
  "deleteCompetition" | "finalizeCompetition" | "getCompetitionDetail" | "saveCompetition" | "saveCoachObjective" | "saveCoachReview"
>;

export interface CompetitionsServiceDeps {
  combatsRepository: CombatsRepository;
  combatScoresRepository: CombatScoresRepository;
  competitionsRepository: CompetitionsRepository;
  userContextService: UserContextService;
  normalizeLastName: (value: unknown) => string;
  canManageCompetition: (
    user: ReturnType<typeof toCanonicalJudoka> | null | undefined,
    competition: ReturnType<typeof toCanonicalCompetition> | null | undefined,
    managedJudokaScope: ManagedJudokaScope | null | undefined
  ) => boolean;
  assertCanAccessCompetition: (
    user: ReturnType<typeof toCanonicalJudoka> | null | undefined,
    competition: ReturnType<typeof toCanonicalCompetition> | null | undefined,
    managedJudokaScope: ManagedJudokaScope | null | undefined,
    message?: string
  ) => void;
  assertCanManageCompetition: (
    user: ReturnType<typeof toCanonicalJudoka> | null | undefined,
    competition: ReturnType<typeof toCanonicalCompetition> | null | undefined,
    managedJudokaScope: ManagedJudokaScope | null | undefined,
    message?: string
  ) => void;
  resolveJudokaDataAccess: (
    user: ReturnType<typeof toCanonicalJudoka> | null | undefined,
    managedJudokaScope: ManagedJudokaScope | undefined
  ) => JudokaDataAccess;
  resolveCompetitionOwnerId: (
    user: ReturnType<typeof toCanonicalJudoka> | null | undefined,
    competition: ReturnType<typeof toCanonicalCompetition> | null | undefined,
    managedJudokaScope: ManagedJudokaScope | null | undefined
  ) => string;
  buildCompetitionId: () => string;
  createCompetition: typeof createCompetition;
  createPersistedCompetition: typeof createPersistedCompetition;
}

export interface CompetitionsService {
  getCompetitionsForUser(user: JudokaRow, managedJudokaScope: ManagedJudokaScope): Promise<Competition[]>;
  methods: CompetitionMethods;
}

export default function createCompetitionsService(
  deps: CompetitionsServiceDeps
): CompetitionsService {
  const {
    combatsRepository,
    combatScoresRepository,
    competitionsRepository,
    userContextService,
    normalizeLastName,
    canManageCompetition,
    assertCanAccessCompetition,
    assertCanManageCompetition,
    resolveJudokaDataAccess,
    resolveCompetitionOwnerId,
    buildCompetitionId,
    createCompetition,
    createPersistedCompetition
  } = deps;

  async function getCompetitionsForUser(
    user: JudokaRow,
    managedJudokaScope: ManagedJudokaScope
  ): Promise<Competition[]> {
    const domainUser = toCanonicalJudoka(user);
    const access = resolveJudokaDataAccess(domainUser, managedJudokaScope);
    let records;

    if (access.isAll()) {
      records = await competitionsRepository.listAll();
    } else {
      const visibleJudokaIds = access.visibleJudokaIds();
      if (!visibleJudokaIds.length) {
        return [];
      }
      const [onlyVisibleJudokaId] = visibleJudokaIds;
      records =
        visibleJudokaIds.length === 1 && onlyVisibleJudokaId !== undefined
          ? await competitionsRepository.listByJudoka(onlyVisibleJudokaId)
          : await competitionsRepository.listByJudokaIds(visibleJudokaIds);
    }

    return records.map(toCanonicalCompetition);
  }

  // COMBAT-SUGG : adversaires déjà rencontrés et techniques déjà marquées par le judoka, du plus fréquent au moins fréquent.
  async function loadCombatSuggestions(judokaId: string): Promise<CombatSuggestions> {
    if (!judokaId) {
      return { opponents: [], techniques: [] };
    }
    const combats = await combatsRepository.listByJudoka(judokaId);
    const scores = await combatScoresRepository.listByCombatIds(combats.map((combat) => combat.id_combat));
    const rankByFrequency = (values: string[], limit: number) => {
      const counts = new Map<string, number>();
      values.map((value) => value.trim()).filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
        .slice(0, limit)
        .map(([value]) => value);
    };
    return {
      opponents: rankByFrequency(combats.map((combat) => String(combat.adversaire || "")), 50),
      techniques: rankByFrequency(
        scores
          .filter((score) => !isConcededScoreRow(score))
          .map((score) => String(score.categorie === "Ne-waza" ? score.type_ne_waza : score.technique || "")),
        8
      )
    };
  }

  async function getCompetitionDetail(email: string, idCompetition: string): Promise<CompetitionDetail> {
    const {
      judokas: contextJudokas,
      managedJudokaScope,
      domainUser
    } = await userContextService.getDomainUserContext(email);
    const access = resolveJudokaDataAccess(domainUser, managedJudokaScope);
    const competitionRecord = await competitionsRepository.getById(idCompetition);

    if (!competitionRecord) {
      throw new Error("Compétition introuvable.");
    }
    const domainCompetition = toCanonicalCompetition(competitionRecord);

    assertCanAccessCompetition(
      domainUser,
      domainCompetition,
      managedJudokaScope,
      "Accès refusé à cette compétition."
    );

    let filtered;
    if (access.isAll()) {
      filtered = await combatsRepository.listByCompetition(idCompetition);
    } else {
      const visibleJudokaIds = access.visibleJudokaIds();
      const [onlyVisibleJudokaId] = visibleJudokaIds;
      filtered =
        visibleJudokaIds.length === 1 && onlyVisibleJudokaId !== undefined
          ? await combatsRepository.listByCompetitionAndJudoka(idCompetition, onlyVisibleJudokaId)
          : await combatsRepository.listByCompetitionAndJudokaIds(idCompetition, visibleJudokaIds);
    }

    const combatScores = await combatScoresRepository.listByCombatIds(
      filtered.map((combat) => combat.id_combat)
    );
    const scoresByCombatId = new Map<string, typeof combatScores>();
    combatScores.forEach((score) => {
      const idCombat = String(score.id_combat);
      scoresByCombatId.set(idCombat, [...(scoresByCombatId.get(idCombat) || []), score]);
    });
    filtered = filtered.map((combat) => {
      const rows = scoresByCombatId.get(String(combat.id_combat)) || [];
      return {
        ...combat,
        scores: rows.filter((row) => !isConcededScoreRow(row)),
        concededScores: rows.filter(isConcededScoreRow)
      };
    });

    const judokas = access.isOwn() ? [] : contextJudokas.map(toCanonicalJudoka);
    const enriched = toCombatReadModelsWithJudokas(filtered, judokas, {
      formatJudokaDisplayName: (judoka) =>
        `${judoka.firstName} ${normalizeLastName(judoka.lastName)}`
    });

    const canEdit = canManageCompetition(domainUser, domainCompetition, managedJudokaScope);
    const combatSuggestions = canEdit
      ? await loadCombatSuggestions(String(domainCompetition.ownerJudokaId || ""))
      : { opponents: [], techniques: [] };

    return {
      competition: toCanonicalCompetition(competitionRecord),
      combats: enriched,
      combatSuggestions,
      isAdmin: domainUser.accessRole === "ADMIN",
      isCoach: domainUser.accessRole === "COACH",
      isParent: access.isManaged(),
      canManageCompetition: canEdit,
      canEditCompetition: canEdit,
      hasInheritedClubCompetitionFields: Boolean(domainCompetition.clubCompetitionId),
      judokas
    };
  }

  async function saveCompetition(email: string, competition: Record<string, unknown>) {
    const { managedJudokaScope, domainUser } = await userContextService.getDomainUserContext(email);
    const domainCompetitionInput = toCanonicalCompetition(competition);
    const ownerJudokaId = resolveCompetitionOwnerId(
      domainUser,
      domainCompetitionInput,
      managedJudokaScope
    );

    const competitionId = domainCompetitionInput.competitionId;

    if (competitionId) {
      const existingCompetition = await competitionsRepository.getById(competitionId);
      if (!existingCompetition) {
        throw new Error("Compétition introuvable.");
      }
      assertCanManageCompetition(
        domainUser,
        toCanonicalCompetition(existingCompetition),
        managedJudokaScope,
        "Modification de cette compétition non autorisée."
      );

      const existingDomainCompetition = toCanonicalCompetition(existingCompetition);
      const inheritedClubFields = existingDomainCompetition.clubCompetitionId
        ? {
            name: existingDomainCompetition.name,
            competitionDate: existingDomainCompetition.competitionDate,
            ageCategory: existingDomainCompetition.ageCategory,
            level: existingDomainCompetition.level
          }
        : {};
      const competitionDraft = createCompetition(
        {
          ...existingDomainCompetition,
          ...domainCompetitionInput,
          ...inheritedClubFields,
          competitionId,
          clubCompetitionId:
            domainCompetitionInput.clubCompetitionId !== null &&
            domainCompetitionInput.clubCompetitionId !== undefined
              ? domainCompetitionInput.clubCompetitionId
              : existingDomainCompetition.clubCompetitionId,
          ownerJudokaId,
          result:
            domainCompetitionInput.result !== null && domainCompetitionInput.result !== undefined
              ? domainCompetitionInput.result
              : existingDomainCompetition.result
        },
        ownerJudokaId
      );
      await assertNoStandaloneDuplicateCompetition(competitionDraft, competitionId);
      await competitionsRepository.update(competitionId, competitionDraft);
      return {
        success: true,
        competitionId,
        message: "Compétition modifiée."
      };
    }

    const idCompetition = buildCompetitionId();
    const competitionDraft = createCompetition(domainCompetitionInput, ownerJudokaId);
    await assertNoStandaloneDuplicateCompetition(competitionDraft);
    await competitionsRepository.insert(competitionDraft, idCompetition);

    return {
      success: true,
      competitionId: idCompetition,
      message: "Compétition créée."
    };
  }

  async function assertNoStandaloneDuplicateCompetition(
    competition: ReturnType<typeof createCompetition>,
    excludedCompetitionId?: string
  ) {
    if (competition.clubCompetitionId) {
      return;
    }

    const duplicate = await competitionsRepository.existsForJudoka(
      competition.ownerJudokaId,
      competition.name,
      competition.competitionDate,
      excludedCompetitionId
    );
    if (!duplicate) {
      return;
    }

    if (duplicate.club_competition_id) {
      throw new Error(
        "Une compétition club existe déjà pour ce judoka à cette date. Ajoutez le judoka à la compétition club existante."
      );
    }

    throw new Error("Ce judoka a déjà une compétition individuelle avec ce nom et cette date.");
  }

  async function finalizeCompetition(email: string, idCompetition: string, result: string) {
    const { managedJudokaScope, domainUser } = await userContextService.getDomainUserContext(email);

    if (!idCompetition) {
      throw new Error("Compétition obligatoire.");
    }

    const competition = await competitionsRepository.getById(idCompetition);
    if (!competition) {
      throw new Error("Compétition introuvable.");
    }
    assertCanManageCompetition(
      domainUser,
      toCanonicalCompetition(competition),
      managedJudokaScope,
      "Finalisation de cette compétition non autorisée."
    );

    const finalization = createPersistedCompetition(toCanonicalCompetition(competition)).finalize(
      result
    );
    await competitionsRepository.updateResult(idCompetition, finalization);

    return {
      success: true,
      competitionId: idCompetition,
      message: "Classement enregistré."
    };
  }

  async function saveCoachObjective(email: string, idCompetition: string, objective: string) {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    if (domainUser.accessRole !== "COACH") {
      throw new Error("Seul un coach peut définir un objectif.");
    }
    const competition = await competitionsRepository.getById(idCompetition);
    if (!competition) {
      throw new Error("Compétition introuvable.");
    }
    await competitionsRepository.updateCoachObjective(idCompetition, objective || "");
    return { success: true, competitionId: idCompetition, message: "Objectif enregistré." };
  }

  async function saveCoachReview(email: string, idCompetition: string, review: string) {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    if (domainUser.accessRole !== "COACH") {
      throw new Error("Seul un coach peut rédiger un bilan.");
    }
    const competition = await competitionsRepository.getById(idCompetition);
    if (!competition) {
      throw new Error("Compétition introuvable.");
    }
    await competitionsRepository.updateCoachReview(idCompetition, review || "");
    return { success: true, competitionId: idCompetition, message: "Bilan enregistré." };
  }

  async function deleteCompetition(email: string, idCompetition: string) {
    const { managedJudokaScope, domainUser } = await userContextService.getDomainUserContext(email);

    if (!idCompetition) {
      throw new Error("Compétition obligatoire.");
    }

    const competition = await competitionsRepository.getById(idCompetition);
    if (!competition) {
      throw new Error("Compétition introuvable.");
    }
    assertCanManageCompetition(
      domainUser,
      toCanonicalCompetition(competition),
      managedJudokaScope,
      "Suppression de cette compétition non autorisée."
    );

    await competitionsRepository.remove(idCompetition);
    return { success: true, message: "Compétition supprimée." };
  }

  return {
    getCompetitionsForUser,
    methods: {
      deleteCompetition,
      finalizeCompetition,
      getCompetitionDetail,
      saveCompetition,
      saveCoachObjective,
      saveCoachReview
    }
  };
}
