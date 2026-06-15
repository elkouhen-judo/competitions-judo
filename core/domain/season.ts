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

export function isDateWithinSeason(dateValue: unknown, bounds: SeasonBounds): boolean {
  const value = String(dateValue || "");
  return value >= bounds.start && value <= bounds.end;
}
