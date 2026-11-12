import {
  toCanonicalCombat,
  toCanonicalCompetition,
  toCanonicalJudoka,
  toCombatReadModelsWithJudokas
} from "./domain-adapters";
import type { createPersistedCompetition } from "../domain/competitions/competition";
import type { updateCombat } from "../domain/competitions/combat";
import type { CombatsRepository } from "../repositories/combats.repository";
import { isConcededScoreRow, type CombatScoresRepository } from "../repositories/combat-scores.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { CombatRow, CombatScoreRow, JudokaRow } from "../repositories/types";
import type { CombatReadModel, ManagedJudokaScope, RpcMethods } from "../types";
import type { UserContextService } from "./user-context.service";

type CombatMethods = Pick<RpcMethods, "ajouterCombat" | "deleteCombat" | "updateCombat">;

export interface CombatsServiceDeps {
  combatsRepository: CombatsRepository;
  combatScoresRepository: CombatScoresRepository;
  competitionsRepository: CompetitionsRepository;
  userContextService: UserContextService;
  normalizeLastName: (value: unknown) => string;
  assertCanManageCombatFor: (
    domainUser: ReturnType<typeof toCanonicalJudoka> | null | undefined,
    judokaId: string,
    managedJudokaScope: ManagedJudokaScope,
    message?: string
  ) => void;
  createCombatUpdate: typeof updateCombat;
  createPersistedCompetition: typeof createPersistedCompetition;
  buildCombatId: () => string;
}

export interface CombatsService {
  methods: CombatMethods;
}

export default function createCombatsService(deps: CombatsServiceDeps): CombatsService {
  const {
    combatsRepository,
    combatScoresRepository,
    competitionsRepository,
    userContextService,
    normalizeLastName,
    assertCanManageCombatFor,
    createCombatUpdate,
    createPersistedCompetition,
    buildCombatId
  } = deps;

  // ECRIT-2 : l'écriture renvoie le combat enregistré, tel que la fiche l'affiche ;
  // le navigateur met à jour son état sans recharger la compétition.
  function toSavedCombat(
    combatRow: CombatRow | null,
    scoreRows: CombatScoreRow[],
    judokas: JudokaRow[]
  ): { combat?: CombatReadModel } {
    if (!combatRow) {
      return {};
    }
    const [combat] = toCombatReadModelsWithJudokas(
      [
        {
          ...combatRow,
          scores: scoreRows.filter((row) => !isConcededScoreRow(row)),
          concededScores: scoreRows.filter(isConcededScoreRow)
        }
      ],
      judokas.map(toCanonicalJudoka),
      {
        formatJudokaDisplayName: (judoka) =>
          `${judoka.firstName} ${normalizeLastName(judoka.lastName)}`
      }
    );
    return combat && combat.combatId ? { combat } : {};
  }

  async function ajouterCombat(email: string, combat: Record<string, unknown>) {
    const domainCombat = toCanonicalCombat(combat);
    const judokaId = domainCombat.judokaId;
    const competitionId = domainCombat.competitionId;
    const [{ managedJudokaScope, domainUser, judokas }, competitionRecord] = await Promise.all([
      userContextService.getDomainUserContext(email),
      competitionsRepository.getById(competitionId)
    ]);

    assertCanManageCombatFor(
      domainUser,
      judokaId,
      managedJudokaScope,
      "Ajout de ce combat non autorisé."
    );

    if (!competitionRecord) {
      throw new Error("Compétition introuvable.");
    }
    const competition = createPersistedCompetition(toCanonicalCompetition(competitionRecord));
    const combatDraft = competition.recordCombat(domainCombat);

    const idCombat = buildCombatId();
    const combatRow = await combatsRepository.insert(combatDraft, idCombat);
    const scoreRows = await combatScoresRepository.replaceForCombat(
      idCombat,
      combatDraft.scores,
      combatDraft.concededScores
    );

    return {
      success: true,
      message: "Combat ajouté.",
      competitionId,
      ...toSavedCombat(combatRow, scoreRows, judokas)
    };
  }

  async function updateCombatMethod(email: string, combat: Record<string, unknown>) {
    const domainCombat = toCanonicalCombat(combat);
    const combatId = domainCombat.combatId;
    const judokaId = domainCombat.judokaId;
    const competitionId = domainCombat.competitionId;
    const [{ managedJudokaScope, domainUser, judokas }, existingCombat, competitionRecord] =
      await Promise.all([
        userContextService.getDomainUserContext(email),
        combatsRepository.getById(combatId),
        competitionsRepository.getById(competitionId)
      ]);
    if (!existingCombat) {
      throw new Error("Combat introuvable.");
    }
    assertCanManageCombatFor(
      domainUser,
      toCanonicalCombat(existingCombat).judokaId,
      managedJudokaScope,
      "Modification de ce combat non autorisée."
    );
    assertCanManageCombatFor(
      domainUser,
      judokaId,
      managedJudokaScope,
      "Modification de ce combat non autorisée."
    );

    createCombatUpdate(domainCombat);
    if (!competitionRecord) {
      throw new Error("Compétition introuvable.");
    }
    const competition = createPersistedCompetition(toCanonicalCompetition(competitionRecord));
    const combatDraft = competition.recordCombat(domainCombat);

    const combatRow = await combatsRepository.update(combatId, combatDraft);
    const scoreRows = await combatScoresRepository.replaceForCombat(
      combatId,
      combatDraft.scores,
      combatDraft.concededScores
    );

    return {
      success: true,
      message: "Combat modifié.",
      competitionId,
      ...toSavedCombat(combatRow, scoreRows, judokas)
    };
  }

  async function deleteCombat(email: string, idCombat: string) {
    if (!idCombat) {
      throw new Error("Combat obligatoire.");
    }

    const [{ managedJudokaScope, domainUser }, combat] = await Promise.all([
      userContextService.getDomainUserContext(email),
      combatsRepository.getById(idCombat)
    ]);
    if (!combat) {
      throw new Error("Combat introuvable.");
    }
    assertCanManageCombatFor(
      domainUser,
      toCanonicalCombat(combat).judokaId,
      managedJudokaScope,
      "Suppression de ce combat non autorisée."
    );

    await combatsRepository.remove(idCombat);
    return { success: true, message: "Combat supprimé." };
  }

  return {
    methods: {
      ajouterCombat,
      deleteCombat,
      updateCombat: updateCombatMethod
    }
  };
}
