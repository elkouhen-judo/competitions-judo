import { isVictoryCombatResult, isLossCombatResult } from "./competitions/combat-result";
import { computeTopDefeatTechniques, computeTopWinTechniques } from "./competitions/combat-technique-breakdown";
import { computeDecisionBreakdown, computeRate } from "./competitions/combat-decision-breakdown";
import { OPPONENT_STANCES } from "./competitions/opponent-stance";
import { HANDEDNESSES, COMPETITION_LEVELS } from "./category-reference";
import { formatCompetitionRankingDisplay } from "./competition-results";
import type {
  Combat,
  CombatScore,
  Competition,
  CoachDashboardDiscipline,
  CoachDashboardGroundShare,
  CoachDashboardHandednessBreakdownEntry,
  CoachDashboardIpponSplit,
  CoachDashboardLevelPodiumBreakdownEntry,
  CoachDashboardMatchupEntry,
  CoachDashboardMonthEntry,
  CoachDashboardQualityIssueEntry,
  CoachDashboardResultLine,
  CoachDashboardScoreHolding,
  CoachDashboardStats
} from "../types";

export type CoachDashboardCombat = Combat & {
  competitionLevel?: string;
  judokaGender?: string;
  judokaHandedness?: string;
};

type DashboardCompetition = Pick<Competition, "result" | "level"> &
  Partial<Pick<Competition, "competitionId" | "clubCompetitionId" | "name" | "ownerJudokaId" | "competitionDate">>;

// STAT-9 : le tableau de bord du coach classe 5 techniques (la fiche saison du judoka en garde 3).
const DASHBOARD_TOP_TECHNIQUES_LIMIT = 5;

// STAT-20 : hors fiche d'un judoka, une statistique porte sur un groupe d'au moins 2 judokas ;
// la garde de l'effectif ne se ventile qu'à partir de 5 judokas.
export const MIN_GROUP_JUDOKAS = 2;
const MIN_HANDEDNESS_BREAKDOWN_JUDOKAS = 5;

const PODIUM_PLACES: Array<{ place: "1er" | "2e" | "3e"; label: string }> = [
  { place: "1er", label: formatCompetitionRankingDisplay("1er") },
  { place: "2e", label: formatCompetitionRankingDisplay("2e") },
  { place: "3e", label: formatCompetitionRankingDisplay("3e") }
];

function isPodium(result: unknown): boolean {
  return PODIUM_PLACES.some(({ place }) => result === place);
}

function isFinalizedCompetitionResult(result: unknown): boolean {
  return Boolean(String(result || "").trim());
}

// Une compétition club comptée une fois, quel que soit son nombre de participants.
function getCompetitionKey(competition: DashboardCompetition, index: number): string {
  return (
    String(competition.clubCompetitionId || "").trim() ||
    String(competition.competitionId || "").trim() ||
    `competition-${index}`
  );
}

function computeAnalyzedCompetitionCount(competitions: DashboardCompetition[]): number {
  return new Set(competitions.map(getCompetitionKey)).size;
}

// STAT-13 : l'effectif se lit en judokas engagés, puis par garde.
// STAT-20 : sous 5 judokas, la garde de chacun se devinerait : elle n'est pas ventilée.
function computeJudokaCountByHandedness(
  combats: CoachDashboardCombat[],
  engagedJudokas: number
): CoachDashboardHandednessBreakdownEntry[] {
  if (engagedJudokas < MIN_HANDEDNESS_BREAKDOWN_JUDOKAS) return [];
  return HANDEDNESSES.map((handedness) => {
    const judokaIds = new Set(
      combats.filter((combat) => combat.judokaHandedness === handedness).map((combat) => combat.judokaId)
    );
    return { handedness, judokaCount: judokaIds.size };
  });
}

function isDecided(combat: Pick<Combat, "result">): boolean {
  return isVictoryCombatResult(combat.result) || isLossCombatResult(combat.result);
}

function isKnownOpponentStance(stance: unknown): boolean {
  return (OPPONENT_STANCES as readonly string[]).includes(String(stance || ""));
}

// STAT-10 : garde du judoka contre garde de l'adversaire, sur les combats gagnés ou perdus.
function computeMatchupBreakdown(combats: CoachDashboardCombat[]): CoachDashboardMatchupEntry[] {
  const known = combats.filter(
    (combat) =>
      isDecided(combat) &&
      (HANDEDNESSES as readonly string[]).includes(combat.judokaHandedness || "") &&
      isKnownOpponentStance(combat.opponentStance)
  );
  return HANDEDNESSES.flatMap((judokaHandedness) =>
    OPPONENT_STANCES.map((opponentStance) => {
      const matchup = known.filter(
        (combat) => combat.judokaHandedness === judokaHandedness && combat.opponentStance === opponentStance
      );
      return {
        judokaHandedness,
        opponentStance,
        label: `${judokaHandedness} contre ${opponentStance.toLowerCase()}`,
        combats: matchup.length,
        victories: matchup.filter((combat) => isVictoryCombatResult(combat.result)).length
      };
    })
  );
}

function hasIpponScore(combat: CoachDashboardCombat, category: "Tachi-waza" | "Ne-waza"): boolean {
  return (combat.scores || []).some((score) => score.value === "Ippon" && score.category === category);
}

function hasAnyIpponScore(combat: CoachDashboardCombat): boolean {
  return (combat.scores || []).some((score) => score.value === "Ippon");
}

// STAT-2 : parmi les victoires avec un point Ippon du judoka, debout ou au sol.
function computeIpponSplit(combats: CoachDashboardCombat[]): CoachDashboardIpponSplit {
  const ipponVictories = combats.filter(
    (combat) => isVictoryCombatResult(combat.result) && hasAnyIpponScore(combat)
  );
  return {
    total: ipponVictories.length,
    standing: ipponVictories.filter((combat) => hasIpponScore(combat, "Tachi-waza")).length,
    ground: ipponVictories.filter((combat) => hasIpponScore(combat, "Ne-waza")).length
  };
}

function toResultLine(key: string, label: string, combats: CoachDashboardCombat[]): CoachDashboardResultLine {
  return {
    key,
    label,
    combats: combats.length,
    victories: combats.filter((combat) => isVictoryCombatResult(combat.result)).length,
    defeats: combats.filter((combat) => isLossCombatResult(combat.result)).length
  };
}

// STAT-16 : une ligne par valeur présente, dans l'ordre de référence, puis « non renseigné ».
function computeResultLines(
  combats: CoachDashboardCombat[],
  order: readonly string[],
  getKey: (combat: CoachDashboardCombat) => string,
  missingLabel: string
): CoachDashboardResultLine[] {
  const lines = order
    .map((key) => toResultLine(key, key, combats.filter((combat) => getKey(combat) === key)))
    .filter((line) => line.combats > 0);
  const unknown = combats.filter((combat) => !order.includes(getKey(combat)));
  return unknown.length ? [...lines, toResultLine("", missingLabel, unknown)] : lines;
}

// STAT-12 : un mois par mois de compétition qui compte des combats ;
// STAT-22 : ou un podium, même sans combat saisi.
function computeMonthBreakdown(
  combats: CoachDashboardCombat[],
  competitions: DashboardCompetition[]
): CoachDashboardMonthEntry[] {
  const monthOf = (value: unknown) => String(value || "").slice(0, 7);
  const monthByCompetitionId = new Map(
    competitions.map((competition) => [String(competition.competitionId || ""), monthOf(competition.competitionDate)])
  );
  const months = new Map<string, CoachDashboardMonthEntry>();
  combats.forEach((combat) => {
    const month = monthByCompetitionId.get(String(combat.competitionId)) || "";
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    const entry = months.get(month) || { month, combats: 0, victories: 0, defeats: 0, podiums: 0 };
    entry.combats += 1;
    if (isVictoryCombatResult(combat.result)) entry.victories += 1;
    if (isLossCombatResult(combat.result)) entry.defeats += 1;
    months.set(month, entry);
  });
  competitions.forEach((competition) => {
    const month = monthOf(competition.competitionDate);
    if (!isPodium(competition.result) || !/^\d{4}-\d{2}$/.test(month)) return;
    const entry = months.get(month) || { month, combats: 0, victories: 0, defeats: 0, podiums: 0 };
    entry.podiums += 1;
    months.set(month, entry);
  });
  return Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));
}

const POINT_VALUE_INDEX: Record<string, number> = { Ippon: 0, "Waza-ari": 1, Yuko: 2 };

// Un camp mène s'il a plus d'Ippon, à égalité plus de Waza-ari, puis plus de Yuko.
function compareSides(judoka: number[], opponent: number[]): number {
  for (let index = 0; index < judoka.length; index += 1) {
    if (judoka[index] !== opponent[index]) return judoka[index] - opponent[index];
  }
  return 0;
}

// STAT-6 : tenue du score, lue point après point sur le déroulé.
function computeScoreHolding(combats: CoachDashboardCombat[]): CoachDashboardScoreHolding {
  const holding: CoachDashboardScoreHolding = {
    counted: 0,
    scoredFirst: 0,
    wonAfterScoringFirst: 0,
    lostAfterLeading: 0,
    wonAfterTrailing: 0
  };
  combats.forEach((combat) => {
    const points = [
      ...(combat.scores || []).map((score) => ({ score, judoka: true })),
      ...(combat.concededScores || []).map((score) => ({ score, judoka: false }))
    ].filter(({ score }) => score.value in POINT_VALUE_INDEX);
    const orders = points.map(({ score }) => score.order);
    const hasFullOrder =
      points.length > 0 &&
      orders.every((order) => typeof order === "number" && Number.isFinite(order)) &&
      new Set(orders).size === orders.length;
    if (!hasFullOrder) return;

    holding.counted += 1;
    const sorted = [...points].sort((a, b) => Number(a.score.order) - Number(b.score.order));
    const judokaCount = [0, 0, 0];
    const opponentCount = [0, 0, 0];
    let judokaLed = false;
    let opponentLed = false;
    sorted.forEach(({ score, judoka }) => {
      (judoka ? judokaCount : opponentCount)[POINT_VALUE_INDEX[score.value]] += 1;
      const lead = compareSides(judokaCount, opponentCount);
      if (lead > 0) judokaLed = true;
      if (lead < 0) opponentLed = true;
    });
    const won = isVictoryCombatResult(combat.result);
    if (sorted[0].judoka) {
      holding.scoredFirst += 1;
      if (won) holding.wonAfterScoringFirst += 1;
    }
    if (isLossCombatResult(combat.result) && judokaLed) holding.lostAfterLeading += 1;
    if (won && opponentLed) holding.wonAfterTrailing += 1;
  });
  return holding;
}

// STAT-7 : part au sol des points dont la catégorie (debout, au sol) est connue.
function computeGroundShare(combats: CoachDashboardCombat[]): CoachDashboardGroundShare {
  const share = (scores: CombatScore[]) => {
    const known = scores.filter((score) => score.category === "Tachi-waza" || score.category === "Ne-waza");
    return { ground: known.filter((score) => score.category === "Ne-waza").length, counted: known.length };
  };
  return {
    scored: share(combats.flatMap((combat) => combat.scores || [])),
    conceded: share(combats.flatMap((combat) => combat.concededScores || []))
  };
}

// STAT-8 : shidos reçus sur les combats au score renseigné, défaites par Hansoku-make.
function computeDiscipline(combats: CoachDashboardCombat[]): CoachDashboardDiscipline {
  const scored = combats.filter((combat) => combat.officialScore);
  return {
    scoredCombats: scored.length,
    shidosReceived: scored.reduce((sum, combat) => sum + Number(combat.officialScore?.judoka.shido || 0), 0),
    hansokuMakeDefeats: combats.filter(
      (combat) => isLossCombatResult(combat.result) && combat.victoryType === "Hansoku-make"
    ).length
  };
}

const COMBAT_QUALITY_CRITERIA: Array<{
  criterion: string;
  label: string;
  isMissing: (combat: CoachDashboardCombat) => boolean;
}> = [
  {
    criterion: "judokaHandedness",
    label: "Droitier/gaucher du judoka non renseigné",
    isMissing: (combat) => !combat.judokaHandedness
  },
  {
    criterion: "opponentStance",
    label: "Droitier/gaucher de l'adversaire non renseigné",
    isMissing: (combat) => !combat.opponentStance
  },
  {
    criterion: "victoryType",
    label: "Fin du combat non renseignée",
    isMissing: (combat) => !combat.victoryType
  },
  {
    criterion: "scores",
    label: "Points marqués non renseignés",
    // Seule une victoire aux points (Ippon, Waza-ari, Yuko) exige un point du judoka.
    isMissing: (combat) =>
      isVictoryCombatResult(combat.result) &&
      ["Ippon", "Waza-ari", "Yuko"].includes(String(combat.victoryType || "")) &&
      !(combat.scores || []).length
  },
  {
    criterion: "inconsistentIppon",
    label: "Ippon à vérifier",
    isMissing: (combat) =>
      isVictoryCombatResult(combat.result) && combat.victoryType === "Ippon" && !hasAnyIpponScore(combat)
  }
];

// Saisies à compléter : seuls les décomptes alimentent la tuile de synthèse (aucune liste).
// STAT-14 : le niveau manquant est une donnée de compétition, compté une fois par compétition.
function computeDataQualityIssues(
  combats: CoachDashboardCombat[],
  competitions: DashboardCompetition[]
): CoachDashboardQualityIssueEntry[] {
  const total = combats.length;
  const combatIssues: CoachDashboardQualityIssueEntry[] = COMBAT_QUALITY_CRITERIA.map(
    ({ criterion, label, isMissing }) => {
      const count = combats.filter(isMissing).length;
      return { criterion, label, count, total, rate: computeRate(count, total), unit: "combat" };
    }
  );

  const competitionsByKey = new Map<string, DashboardCompetition>();
  competitions.forEach((competition, index) => {
    const key = getCompetitionKey(competition, index);
    if (!competitionsByKey.has(key)) competitionsByKey.set(key, competition);
  });
  const withoutLevel = Array.from(competitionsByKey.values()).filter((competition) => !competition.level).length;
  const levelIssue: CoachDashboardQualityIssueEntry = {
    criterion: "competitionLevel",
    label: "Niveau de compétition non renseigné",
    count: withoutLevel,
    total: competitionsByKey.size,
    rate: computeRate(withoutLevel, competitionsByKey.size),
    unit: "competition"
  };
  // Le niveau garde sa place d'origine, après les critères de saisie du combat.
  return [...combatIssues.slice(0, 4), levelIssue, ...combatIssues.slice(4)];
}

// STAT-11 : podiums et participations classées, par niveau.
function computePodiumBreakdownByLevel(competitions: DashboardCompetition[]): CoachDashboardLevelPodiumBreakdownEntry[] {
  const finalizedCompetitions = competitions.filter((competition) =>
    isFinalizedCompetitionResult(competition.result)
  );
  return COMPETITION_LEVELS.map((level) => {
    const levelCompetitions = finalizedCompetitions.filter((competition) => competition.level === level);
    return {
      level,
      podiums: PODIUM_PLACES.map(({ place, label }) => ({
        place,
        label,
        count: levelCompetitions.filter((competition) => competition.result === place).length
      })),
      rankedParticipations: levelCompetitions.length
    };
  });
}

function countJudokasWithCombats(combats: Array<Pick<Combat, "judokaId">>): number {
  return new Set(combats.map((combat) => String(combat.judokaId))).size;
}

/**
 * STAT-20 : les statistiques de groupe exigent au moins 2 judokas. Ce sont ceux qui ont combattu ;
 * sans aucun combat, ceux dont une compétition est retenue (les podiums restent nominatifs sinon).
 */
export function isGroupScope(
  combats: Array<Pick<Combat, "judokaId">>,
  competitions: Array<Partial<Pick<Competition, "ownerJudokaId">>>
): boolean {
  const fighters = countJudokasWithCombats(combats);
  if (fighters) return fighters >= MIN_GROUP_JUDOKAS;
  const owners = new Set(
    competitions.map((competition) => String(competition.ownerJudokaId || "")).filter(Boolean)
  ).size;
  return owners === 0 || owners >= MIN_GROUP_JUDOKAS;
}

/** STAT-20 : seul ce qui reste dit d'un périmètre trop petit pour des statistiques de groupe. */
export function computeWithheldScope(
  combats: Array<Pick<Combat, "judokaId">>,
  competitions: DashboardCompetition[]
): { analyzedCompetitions: number; totalCombats: number } {
  return { analyzedCompetitions: computeAnalyzedCompetitionCount(competitions), totalCombats: combats.length };
}

export function computeCoachDashboardStats(
  combats: CoachDashboardCombat[],
  competitions: DashboardCompetition[] = []
): CoachDashboardStats {
  const totalCombats = combats.length;
  const victories = combats.filter((combat) => isVictoryCombatResult(combat.result)).length;
  const defeats = combats.filter((combat) => isLossCombatResult(combat.result)).length;
  const engagedJudokas = countJudokasWithCombats(combats);

  return {
    analyzedCompetitions: computeAnalyzedCompetitionCount(competitions),
    totalCombats,
    victories,
    defeats,
    draws: totalCombats - victories - defeats,
    victoryRate: computeRate(victories, totalCombats),
    ipponVictories: computeIpponSplit(combats),
    victoriesByDecisionType: computeDecisionBreakdown(combats, "Victoire"),
    defeatsByDecisionType: computeDecisionBreakdown(combats, "Défaite"),
    byLateralMatchup: computeMatchupBreakdown(combats),
    engagedJudokas,
    judokasByHandedness: computeJudokaCountByHandedness(combats, engagedJudokas),
    dataQualityIssues: computeDataQualityIssues(combats, competitions),
    podiumsByLevel: computePodiumBreakdownByLevel(competitions),
    topWinTechniques: computeTopWinTechniques(combats, DASHBOARD_TOP_TECHNIQUES_LIMIT),
    topDefeatTechniques: computeTopDefeatTechniques(combats, DASHBOARD_TOP_TECHNIQUES_LIMIT),
    byLevel: computeResultLines(
      combats,
      COMPETITION_LEVELS,
      (combat) => String(combat.competitionLevel || ""),
      "Niveau non renseigné"
    ),
    byMonth: computeMonthBreakdown(combats, competitions),
    scoreHolding: computeScoreHolding(combats),
    groundShare: computeGroundShare(combats),
    discipline: computeDiscipline(combats)
  };
}
