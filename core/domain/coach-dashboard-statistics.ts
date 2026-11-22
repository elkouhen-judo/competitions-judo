import { isVictoryCombatResult, isLossCombatResult } from "./competitions/combat-result";
import { computeTopDefeatTechniques, computeTopWinTechniques } from "./competitions/combat-technique-breakdown";
import { computeDecisionBreakdown, computeRate } from "./competitions/combat-decision-breakdown";
import { COMPETITION_LEVELS } from "./category-reference";
import { formatSeasonLabel, getSeasonStartYear } from "./season";
import type {
  Combat,
  CombatScore,
  Competition,
  CoachDashboardClubEntry,
  CoachDashboardGroundShare,
  CoachDashboardPeriodEntry,
  CoachDashboardResultLine,
  CoachDashboardStats
} from "../types";

export type CoachDashboardCombat = Combat & {
  competitionLevel?: string;
};

type DashboardCompetition = Pick<Competition, "result" | "level"> &
  Partial<Pick<Competition, "competitionId" | "clubCompetitionId" | "name" | "ownerJudokaId" | "competitionDate">>;

// STAT-9 : le tableau de bord du coach classe 5 techniques (la fiche saison du judoka en garde 3).
const DASHBOARD_TOP_TECHNIQUES_LIMIT = 5;

// STAT-20 : hors fiche d'un judoka, une statistique porte sur un groupe d'au moins 2 judokas.
export const MIN_GROUP_JUDOKAS = 2;

const PODIUM_PLACES = ["1er", "2e", "3e"];

function isPodium(result: unknown): boolean {
  return PODIUM_PLACES.includes(String(result || ""));
}

export interface CoachDashboardStatsOptions {
  /** Date du jour (AAAA-MM-JJ) : une participation datée après n'est pas encore une participation. */
  today?: string;
}

// STAT-27 : une participation compte une fois sa date passée ; sans date, elle compte.
function isPastParticipation(competition: DashboardCompetition, today: string): boolean {
  const date = String(competition.competitionDate || "");
  return !today || !date || date <= today;
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

// STAT-16 : bilan d'un niveau ; STAT-11 : podiums sur les participations classées de ce niveau.
function toLevelLine(
  key: string,
  label: string,
  combats: CoachDashboardCombat[],
  competitions: DashboardCompetition[]
): CoachDashboardResultLine {
  const ranked = competitions.filter((competition) => isFinalizedCompetitionResult(competition.result));
  return {
    key,
    label,
    combats: combats.length,
    victories: combats.filter((combat) => isVictoryCombatResult(combat.result)).length,
    defeats: combats.filter((combat) => isLossCombatResult(combat.result)).length,
    podiums: ranked.filter((competition) => isPodium(competition.result)).length,
    rankedParticipations: ranked.length
  };
}

// Une ligne par niveau présent, dans l'ordre de référence, puis « Niveau non renseigné ».
// La somme des lignes donne les combats et les podiums des tuiles.
function computeLevelLines(
  combats: CoachDashboardCombat[],
  competitions: DashboardCompetition[]
): CoachDashboardResultLine[] {
  const levels = COMPETITION_LEVELS as readonly string[];
  const combatLevel = (combat: CoachDashboardCombat) => String(combat.competitionLevel || "");
  const competitionLevel = (competition: DashboardCompetition) => String(competition.level || "");
  const lines = levels.map((level) =>
    toLevelLine(
      level,
      level,
      combats.filter((combat) => combatLevel(combat) === level),
      competitions.filter((competition) => competitionLevel(competition) === level)
    )
  );
  lines.push(
    toLevelLine(
      "",
      "Niveau non renseigné",
      combats.filter((combat) => !levels.includes(combatLevel(combat))),
      competitions.filter((competition) => !levels.includes(competitionLevel(competition)))
    )
  );
  return lines.filter((line) => line.combats > 0 || line.rankedParticipations > 0);
}

// STAT-24 : trimestres de saison (septembre–novembre, décembre–février, mars–mai, juin–août).
const QUARTER_LABELS = ["Sept.-nov.", "Déc.-févr.", "Mars-mai", "Juin-août"];

function getQuarter(date: string, seasonStartYear: number): { key: string; label: string } {
  const month = Number(date.slice(5, 7));
  const index = Math.floor((((month - 9) % 12) + 12) % 12 / 3);
  const year = index === 0 ? seasonStartYear : seasonStartYear + 1;
  const label =
    index === 1
      ? `Déc. ${seasonStartYear}-févr. ${seasonStartYear + 1}`
      : `${QUARTER_LABELS[index]} ${year}`;
  return { key: `${seasonStartYear}-T${index + 1}`, label };
}

// STAT-24 : une ligne par trimestre quand tout tient dans une saison, sinon une ligne par saison.
// STAT-22 : une ligne sans combat mais avec un podium reste listée.
function computePeriodBreakdown(
  combats: CoachDashboardCombat[],
  competitions: DashboardCompetition[],
  today: string
): CoachDashboardPeriodEntry[] {
  const dated = competitions.filter((competition) =>
    /^\d{4}-\d{2}-\d{2}/.test(String(competition.competitionDate || ""))
  );
  const seasons = new Set(dated.map((competition) => getSeasonStartYear(competition.competitionDate)));
  const bySeason = seasons.size > 1;
  const periodOf = (date: string) => {
    const season = getSeasonStartYear(date) as number;
    return bySeason
      ? { key: String(season), label: `Saison ${formatSeasonLabel(season)}` }
      : getQuarter(date, season);
  };
  const periods = new Map<string, CoachDashboardPeriodEntry>();
  const entryFor = (date: string) => {
    const { key, label } = periodOf(date);
    const entry = periods.get(key) || {
      key,
      label,
      participations: 0,
      combats: 0,
      victories: 0,
      defeats: 0,
      podiums: 0
    };
    periods.set(key, entry);
    return entry;
  };
  const dateByCompetitionId = new Map(
    dated.map((competition) => [String(competition.competitionId || ""), String(competition.competitionDate)])
  );
  dated.forEach((competition) => {
    const date = String(competition.competitionDate);
    if (isPastParticipation(competition, today)) entryFor(date).participations += 1;
    if (isPodium(competition.result)) entryFor(date).podiums += 1;
  });
  combats.forEach((combat) => {
    const date = dateByCompetitionId.get(String(combat.competitionId));
    if (!date) return;
    const entry = entryFor(date);
    entry.combats += 1;
    if (isVictoryCombatResult(combat.result)) entry.victories += 1;
    if (isLossCombatResult(combat.result)) entry.defeats += 1;
  });
  return Array.from(periods.values())
    .filter((entry) => entry.combats > 0 || entry.podiums > 0)
    .sort((a, b) => a.key.localeCompare(b.key));
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

/**
 * MULTI-6 : le bilan de chaque club, dans l'ordre donné. Un club sous le seuil de groupe
 * (STAT-20, DASH-027) reste listé, sans aucun chiffre.
 */
export function computeClubBreakdown(
  clubIds: string[],
  combats: CoachDashboardCombat[],
  competitions: DashboardCompetition[],
  clubIdByCompetitionId: Map<string, string>,
  today: string
): CoachDashboardClubEntry[] {
  const clubOf = (competitionId: unknown) => clubIdByCompetitionId.get(String(competitionId || "")) || "";
  return clubIds.map((clubId) => {
    const clubCompetitions = competitions.filter((competition) => clubOf(competition.competitionId) === clubId);
    const clubCombats = combats.filter((combat) => clubOf(combat.competitionId) === clubId);
    const empty = { clubId, engagedJudokas: 0, participations: 0, combats: 0, victories: 0, podiums: 0 };
    if (!clubCompetitions.length || !isGroupScope(clubCombats, clubCompetitions)) {
      return { ...empty, withheld: clubCompetitions.length > 0 };
    }
    return {
      clubId,
      withheld: false,
      engagedJudokas: countJudokasWithCombats(clubCombats),
      participations: clubCompetitions.filter((competition) => isPastParticipation(competition, today)).length,
      combats: clubCombats.length,
      victories: clubCombats.filter((combat) => isVictoryCombatResult(combat.result)).length,
      podiums: clubCompetitions.filter((competition) => isPodium(competition.result)).length
    };
  });
}

/** STAT-20 : seul ce qui reste dit d'un périmètre trop petit pour des statistiques de groupe. */
export function computeWithheldScope(
  combats: Array<Pick<Combat, "judokaId">>,
  competitions: DashboardCompetition[]
): { analyzedCompetitions: number; totalCombats: number } {
  return { analyzedCompetitions: computeAnalyzedCompetitionCount(competitions), totalCombats: combats.length };
}

// STAT-27 : participations passées, et celles qui n'ont aucun combat saisi.
function computeParticipations(
  combats: CoachDashboardCombat[],
  competitions: DashboardCompetition[],
  today: string
): { participations: number; participationsWithoutCombat: number } {
  const past = competitions.filter((competition) => isPastParticipation(competition, today));
  const withCombat = new Set(combats.map((combat) => String(combat.competitionId)));
  return {
    participations: past.length,
    participationsWithoutCombat: past.filter(
      (competition) => !withCombat.has(String(competition.competitionId || ""))
    ).length
  };
}

export function computeCoachDashboardStats(
  combats: CoachDashboardCombat[],
  competitions: DashboardCompetition[] = [],
  options: CoachDashboardStatsOptions = {}
): CoachDashboardStats {
  const today = String(options.today || "");
  const totalCombats = combats.length;
  const victories = combats.filter((combat) => isVictoryCombatResult(combat.result)).length;
  const defeats = combats.filter((combat) => isLossCombatResult(combat.result)).length;

  return {
    analyzedCompetitions: computeAnalyzedCompetitionCount(competitions),
    totalCombats,
    victories,
    defeats,
    draws: totalCombats - victories - defeats,
    victoryRate: computeRate(victories, totalCombats),
    victoriesByDecisionType: computeDecisionBreakdown(combats, "Victoire"),
    defeatsByDecisionType: computeDecisionBreakdown(combats, "Défaite"),
    engagedJudokas: countJudokasWithCombats(combats),
    topWinTechniques: computeTopWinTechniques(combats, DASHBOARD_TOP_TECHNIQUES_LIMIT),
    topDefeatTechniques: computeTopDefeatTechniques(combats, DASHBOARD_TOP_TECHNIQUES_LIMIT),
    byLevel: computeLevelLines(combats, competitions),
    byPeriod: computePeriodBreakdown(combats, competitions, today),
    ...computeParticipations(combats, competitions, today),
    groundShare: computeGroundShare(combats)
  };
}
