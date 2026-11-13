import {
  toCombatReadModelsWithJudokas,
  toCanonicalCompetition,
  toCanonicalJudoka
} from "./domain-adapters";
import type { createCompetition, createPersistedCompetition } from "../domain/competitions/competition";
import type { CombatsRepository } from "../repositories/combats.repository";
import { isConcededScoreRow, splitCombatScores } from "../repositories/combat-scores.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { CombatSuggestions, CompetitionDetail, ManagedJudokaScope, RpcMethods } from "../types";
import type { UserContextService } from "./user-context.service";

interface JudokaDataAccess {
  isAll(): boolean;
  isManaged(): boolean;
  isOwn(): boolean;
  visibleJudokaIds(): string[] | null;
}

type CompetitionMethods = Pick<
  RpcMethods,
  | "deleteCompetition"
  | "finalizeCompetition"
  | "getCombatSuggestions"
  | "getCompetitionDetail"
  | "saveCompetition"
  | "saveCoachReview"
>;

export interface CompetitionsServiceDeps {
  combatsRepository: Pick<CombatsRepository, "listByCompetitionWithScores" | "listSuggestionsByJudoka">;
  competitionsRepository: CompetitionsRepository;
  userContextService: UserContextService;
  normalizeLastName: (value: unknown) => string;
  canManageCombatFor: (
    user: ReturnType<typeof toCanonicalJudoka> | null | undefined,
    idJudoka: unknown,
    managedJudokaScope: ManagedJudokaScope | null | undefined
  ) => boolean;
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
  methods: CompetitionMethods;
}

export default function createCompetitionsService(
  deps: CompetitionsServiceDeps
): CompetitionsService {
  const {
    combatsRepository,
    competitionsRepository,
    userContextService,
    normalizeLastName,
    canManageCombatFor,
    canManageCompetition,
    assertCanAccessCompetition,
    assertCanManageCompetition,
    resolveJudokaDataAccess,
    resolveCompetitionOwnerId,
    buildCompetitionId,
    createCompetition,
    createPersistedCompetition
  } = deps;

  // COMBAT-SUGG : adversaires déjà rencontrés et techniques déjà marquées par le judoka, du plus
  // fréquent au moins fréquent. DETAIL-2 : chargées à l'ouverture du formulaire de combat.
  async function getCombatSuggestions(email: string, judokaId: string): Promise<CombatSuggestions> {
    const { managedJudokaScope, domainUser } = await userContextService.getDomainUserContext(email);
    if (!judokaId || !canManageCombatFor(domainUser, judokaId, managedJudokaScope)) {
      return { opponents: [], opponentStances: {}, techniques: [] };
    }
    const combats = await combatsRepository.listSuggestionsByJudoka(judokaId);
    const rankByFrequency = (values: string[], limit: number) => {
      const counts = new Map<string, number>();
      values.map((value) => value.trim()).filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
        .slice(0, limit)
        .map(([value]) => value);
    };
    // Les combats sont lus du plus ancien au plus récent : la dernière garde renseignée l'emporte.
    const opponentStances: Record<string, string> = {};
    combats.forEach((combat) => {
      const opponent = String(combat.adversaire || "").trim();
      const stance = String(combat.garde_adversaire || "").trim();
      if (opponent && stance) opponentStances[opponent] = stance;
    });
    return {
      opponents: rankByFrequency(combats.map((combat) => String(combat.adversaire || "")), 50),
      opponentStances,
      techniques: rankByFrequency(
        combats
          .flatMap((combat) => (Array.isArray(combat.combat_scores) ? combat.combat_scores : []))
          .filter((score) => !isConcededScoreRow(score))
          .map((score) => String(score.categorie === "Ne-waza" ? score.type_ne_waza : score.technique || "")),
        8
      )
    };
  }

  // DETAIL-1 : le contexte, la compétition et ses combats (avec leurs points) partent ensemble ;
  // rien n'est renvoyé tant que l'accès n'est pas vérifié.
  async function getCompetitionDetail(email: string, idCompetition: string): Promise<CompetitionDetail> {
    const [context, competitionRecord, combatRows] = await Promise.all([
      userContextService.getDomainUserContext(email),
      competitionsRepository.getById(idCompetition),
      combatsRepository.listByCompetitionWithScores(idCompetition)
    ]);
    const { judokas: contextJudokas, managedJudokaScope, domainUser } = context;
    const access = resolveJudokaDataAccess(domainUser, managedJudokaScope);

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

    const visibleJudokaIds = new Set((access.visibleJudokaIds() || []).map(String));
    const filtered = combatRows
      .filter((combat) => access.isAll() || visibleJudokaIds.has(String(combat.id_judoka)))
      .map(splitCombatScores);

    const judokas = access.isOwn() ? [] : contextJudokas.map(toCanonicalJudoka);
    const enriched = toCombatReadModelsWithJudokas(filtered, judokas, {
      formatJudokaDisplayName: (judoka) =>
        `${judoka.firstName} ${normalizeLastName(judoka.lastName)}`
    });

    const canEdit = canManageCompetition(domainUser, domainCompetition, managedJudokaScope);

    return {
      competition: domainCompetition,
      combats: enriched,
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
      const updated = await competitionsRepository.update(competitionId, competitionDraft);
      return {
        success: true,
        competitionId,
        message: "Compétition modifiée.",
        ...savedCompetition(updated)
      };
    }

    const idCompetition = buildCompetitionId();
    const competitionDraft = createCompetition(domainCompetitionInput, ownerJudokaId);
    await assertNoStandaloneDuplicateCompetition(competitionDraft);
    const inserted = await competitionsRepository.insert(competitionDraft, idCompetition);

    return {
      success: true,
      competitionId: idCompetition,
      message: "Compétition créée.",
      ...savedCompetition(inserted)
    };
  }

  // ECRIT-2 : l'écriture renvoie la compétition enregistrée, le navigateur met à jour son état.
  function savedCompetition(row: object | null) {
    const competition = row ? toCanonicalCompetition(row) : null;
    return competition && competition.competitionId ? { competition } : {};
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
    const updated = await competitionsRepository.updateResult(idCompetition, finalization);

    return {
      success: true,
      competitionId: idCompetition,
      message: "Classement enregistré.",
      ...savedCompetition(updated)
    };
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
    methods: {
      deleteCompetition,
      finalizeCompetition,
      getCombatSuggestions,
      getCompetitionDetail,
      saveCompetition,
      saveCoachReview
    }
  };
}
