/** Score IWY (Ippon, Waza-ari, Yuko) d'un camp. */
export interface CombatSideScore {
  ippon: number;
  wazaAri: number;
  yuko: number;
}

/** COMBAT-SCORE : score officiel IWY - IWY, saisi à part des points détaillés. */
export interface CombatOfficialScore {
  judoka: CombatSideScore;
  opponent: CombatSideScore;
}

export const COMBAT_SCORE_MAX = 9;

function createScoreCount(value: unknown): number {
  const count = Number(value ?? 0);
  if (!Number.isInteger(count) || count < 0 || count > COMBAT_SCORE_MAX) {
    throw new Error(`Score invalide : chaque valeur doit être un entier entre 0 et ${COMBAT_SCORE_MAX}.`);
  }
  return count;
}

function createSideScore(side: unknown): CombatSideScore {
  const source = (side || {}) as Record<string, unknown>;
  return {
    ippon: createScoreCount(source.ippon),
    wazaAri: createScoreCount(source.wazaAri),
    yuko: createScoreCount(source.yuko)
  };
}

/**
 * null : score non renseigné (ou effacé).
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
  return {
    judoka: createSideScore(source.judoka),
    opponent: createSideScore(source.opponent)
  };
}
