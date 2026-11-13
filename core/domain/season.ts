import type { SeasonBounds } from "../types";

export function getCurrentSeasonBounds(referenceDate: Date = new Date()): SeasonBounds {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  const startYear = month >= 8 ? year : year - 1;
  return {
    start: `${startYear}-09-01`,
    end: `${startYear + 1}-08-31`,
    label: `${startYear}-${startYear + 1}`
  };
}

/** INSCR : année de début de la saison (1er septembre – 31 août) d'une date « AAAA-MM-JJ », ou null. */
export function getSeasonStartYear(dateValue: unknown): number | null {
  const match = /^(\d{4})-(\d{2})-\d{2}/.exec(String(dateValue || ""));
  if (!match) return null;
  const year = Number(match[1]);
  return Number(match[2]) >= 9 ? year : year - 1;
}

/** INSCR : libellé « 2026-2027 » d'une saison. */
export function formatSeasonLabel(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}

/**
 * INSCR-2 : un judoka peut participer à une compétition dont la saison n'est pas postérieure à sa
 * dernière saison d'inscription. Un judoka jamais inscrit ne peut participer à aucune compétition.
 * Une date illisible est laissée aux autres contrôles.
 */
export function isRegisteredForCompetitionDate(registrationSeason: unknown, competitionDate: unknown): boolean {
  const competitionSeason = getSeasonStartYear(competitionDate);
  if (competitionSeason === null) return true;
  const season = Number(registrationSeason);
  if (registrationSeason === null || registrationSeason === undefined || !Number.isInteger(season)) return false;
  return competitionSeason <= season;
}

export function isDateWithinSeason(dateValue: unknown, bounds: SeasonBounds): boolean {
  const value = String(dateValue || "");
  return value >= bounds.start && value <= bounds.end;
}
