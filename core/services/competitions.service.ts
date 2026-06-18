import {
  toCombatReadModelsWithJudokas,
  toCanonicalCompetition,
  toCanonicalJudoka
} from "./domain-adapters";
import type { createCompetition, createPersistedCompetition } from "../domain/competitions/competition";
import type { CombatsRepository } from "../repositories/combats.repository";
import type { CombatScoresRepository } from "../repositories/combat-scores.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { JudokaRow } from "../repositories/types";
import type { Competition, CompetitionDetail, ManagedJudokaScope, RpcMethods } from "../types";
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
  generateCompetitionAnalysis: (idCompetition: string) => Promise<string | null>;
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
    createPersistedCompetition,
    generateCompetitionAnalysis
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
    filtered = filtered.map((combat) => ({
      ...combat,
      scores: scoresByCombatId.get(String(combat.id_combat)) || []
    }));

    const judokas = access.isOwn() ? [] : contextJudokas.map(toCanonicalJudoka);
    const enriched = toCombatReadModelsWithJudokas(filtered, judokas, {
      formatJudokaDisplayName: (judoka) =>
        `${judoka.firstName} ${normalizeLastName(judoka.lastName)}`
    });

    return {
      competition: toCanonicalCompetition(competitionRecord),
      combats: enriched,
      isAdmin: domainUser.accessRole === "ADMIN",
      isCoach: domainUser.accessRole === "COACH",
      isParent: access.isManaged(),
      canManageCompetition: canManageCompetition(domainUser, domainCompetition, managedJudokaScope),
      canEditCompetition: canManageCompetition(domainUser, domainCompetition, managedJudokaScope),
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
      const competitionDraft = createCompetition(
        {
          ...existingDomainCompetition,
          ...domainCompetitionInput,
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
      await competitionsRepository.update(competitionId, competitionDraft);
      return {
        success: true,
        competitionId,
        message: "Compétition modifiée."
      };
    }

    const idCompetition = buildCompetitionId();
    const competitionDraft = createCompetition(domainCompetitionInput, ownerJudokaId);
    await competitionsRepository.insert(competitionDraft, idCompetition);

    return {
      success: true,
      competitionId: idCompetition,
      message: "Compétition créée."
    };
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

    try {
      await generateCompetitionAnalysis(idCompetition);
    } catch (error) {
      console.error("Échec de la génération de l'analyse IA :", error);
    }

    return {
      success: true,
      competitionId: idCompetition,
      message: "Classement enregistré."
    };
  }

  async function saveCoachObjective(email: string, idCompetition: string, objective: string) {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    if (domainUser.accessRole !== "COACH" && domainUser.accessRole !== "ADMIN") {
      throw new Error("Seul un coach ou administrateur peut définir un objectif.");
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
    if (domainUser.accessRole !== "COACH" && domainUser.accessRole !== "ADMIN") {
      throw new Error("Seul un coach ou administrateur peut rédiger un bilan.");
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
