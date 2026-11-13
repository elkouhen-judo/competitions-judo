/** Score IWY (Ippon, Waza-ari, Yuko) et shidos d'un camp. */
export interface CombatSideScore {
  ippon: number;
  wazaAri: number;
  yuko: number;
  /** COMBAT-SHIDO : pénalités reçues (0 à 3) ; absent sur les anciens scores. */
  shido?: number;
}

/** COMBAT-SCORE : score officiel IWY - IWY, saisi à part des points détaillés. */
export interface CombatOfficialScore {
  judoka: CombatSideScore;
  opponent: CombatSideScore;
}

export const COMBAT_SCORE_MAX = 9;
export const COMBAT_IPPON_MAX = 1;
export const COMBAT_SHIDO_MAX = 3;

function createScoreCount(value: unknown, max: number, label: string): number {
  const count = Number(value ?? 0);
  if (!Number.isInteger(count) || count < 0 || count > max) {
    throw new Error(`Score invalide : ${label} doit être un entier entre 0 et ${max}.`);
  }
  return count;
}

function createSideScore(side: unknown): CombatSideScore {
  const source = (side || {}) as Record<string, unknown>;
  return {
    ippon: createScoreCount(source.ippon, COMBAT_IPPON_MAX, "Ippon"),
    wazaAri: createScoreCount(source.wazaAri, COMBAT_SCORE_MAX, "Waza-ari"),
    yuko: createScoreCount(source.yuko, COMBAT_SCORE_MAX, "Yuko"),
    shido: createScoreCount(source.shido, COMBAT_SHIDO_MAX, "Shido")
  };
}

/** SCORE-VIDE : 0 0 0 - 0 0 0 sans shido ne dit rien du combat ; il vaut « non renseigné ». */
export function isEmptyCombatOfficialScore(score: CombatOfficialScore): boolean {
  return [score.judoka, score.opponent].every(
    (side) => !side.ippon && !side.wazaAri && !side.yuko && !side.shido
  );
}

/**
 * null : score non renseigné (ou effacé), y compris un score entièrement nul.
 * undefined : score absent de la saisie, à laisser inchangé (ex. outil MCP qui ne le connaît pas).
 */
export function createCombatOfficialScore(score: unknown): CombatOfficialScore | null | undefined {
  if (score === undefined) {
    return undefined;
  }
  if (!score || typeof score !== "object") {
    return null;
  }
  const source = score as Record<string, unknown>;
  const official = {
    judoka: createSideScore(source.judoka),
    opponent: createSideScore(source.opponent)
  };
  return isEmptyCombatOfficialScore(official) ? null : official;
}
