import { createCompetitionAgeCategory, type AgeCategory } from "./competitions/competition";

export const GENDERS = ["Homme", "Femme"] as const;
export type Gender = (typeof GENDERS)[number];

export const HANDEDNESSES = ["Droitier", "Gaucher"] as const;
export type Handedness = (typeof HANDEDNESSES)[number];

/**
 * FFJDA weight categories (2025-2026 season). Poussinet and Poussin compete
 * without official weight divisions, so they are intentionally absent here
 * (free text for those age categories). Vétéran reuses the Senior weight
 * scale (the body division doesn't change past Senior, only the age band).
 */
const SENIOR_WEIGHT_CATEGORIES: Record<Gender, string[]> = {
  "Homme": ["-60kg", "-66kg", "-73kg", "-81kg", "-90kg", "-100kg", "+100kg"],
  "Femme": ["-48kg", "-52kg", "-57kg", "-63kg", "-70kg", "-78kg", "+78kg"]
};

const WEIGHT_CATEGORIES_BY_AGE_AND_GENDER: Partial<Record<AgeCategory, Record<Gender, string[]>>> = {
  Benjamin: {
    "Homme": ["-30kg", "-34kg", "-38kg", "-42kg", "-46kg", "-50kg", "-55kg", "-60kg", "-66kg", "+66kg"],
    "Femme": ["-32kg", "-36kg", "-40kg", "-44kg", "-48kg", "-52kg", "-57kg", "-63kg", "+63kg"]
  },
  Minime: {
    "Homme": ["-34kg", "-38kg", "-42kg", "-46kg", "-50kg", "-55kg", "-60kg", "-66kg", "-73kg", "+73kg"],
    "Femme": ["-36kg", "-40kg", "-44kg", "-48kg", "-52kg", "-57kg", "-63kg", "-70kg", "+70kg"]
  },
  Cadet: {
    "Homme": ["-46kg", "-50kg", "-55kg", "-60kg", "-66kg", "-73kg", "-81kg", "-90kg", "+90kg"],
    "Femme": ["-40kg", "-44kg", "-48kg", "-52kg", "-57kg", "-63kg", "-70kg", "+70kg"]
  },
  Junior: {
    "Homme": ["-55kg", "-60kg", "-66kg", "-73kg", "-81kg", "-90kg", "-100kg", "+100kg"],
    "Femme": ["-44kg", "-48kg", "-52kg", "-57kg", "-63kg", "-70kg", "-78kg", "+78kg"]
  },
  Senior: SENIOR_WEIGHT_CATEGORIES,
  "Vétéran": SENIOR_WEIGHT_CATEGORIES
};

/**
 * Number of valid "année dans la catégorie" values. Senior and Vétéran are
 * open/age-banded categories where this concept doesn't apply.
 */
const YEARS_IN_CATEGORY_COUNT: Partial<Record<AgeCategory, number>> = {
  Poussinet: 2,
  Poussin: 2,
  Benjamin: 2,
  Minime: 2,
  Cadet: 3,
  Junior: 3
};

function normalizeAgeCategoryForLookup(ageCategory: unknown): AgeCategory | null {
  try {
    return createCompetitionAgeCategory(ageCategory) || null;
  } catch {
    return null;
  }
}

function normalizeGenderForLookup(gender: unknown): Gender | null {
  const trimmed = typeof gender === "string" ? gender.trim() : "";
  return (GENDERS as readonly string[]).includes(trimmed) ? (trimmed as Gender) : null;
}

function normalizeWeightCategoryKey(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

export function getWeightCategoriesFor(ageCategory: unknown, gender?: unknown): string[] | null {
  const normalizedAgeCategory = normalizeAgeCategoryForLookup(ageCategory);
  if (!normalizedAgeCategory) {
    return null;
  }
  const byGender = WEIGHT_CATEGORIES_BY_AGE_AND_GENDER[normalizedAgeCategory];
  if (!byGender) {
    return null;
  }
  const normalizedGender = normalizeGenderForLookup(gender);
  if (normalizedGender) {
    return byGender[normalizedGender];
  }
  return [...new Set([...byGender["Homme"], ...byGender["Femme"]])];
}

export function createWeightCategory(value: unknown, ageCategory: unknown, gender?: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return "";
  }

  const allowed = getWeightCategoriesFor(ageCategory, gender);
  if (!allowed) {
    return raw;
  }

  const normalizedRaw = normalizeWeightCategoryKey(raw);
  const match = allowed.find((entry) => normalizeWeightCategoryKey(entry) === normalizedRaw);
  if (!match) {
    throw new Error("Catégorie de poids invalide pour cette catégorie d'âge.");
  }
  return match;
}

export function getValidYearsInCategory(ageCategory: unknown): string[] | null {
  const normalizedAgeCategory = normalizeAgeCategoryForLookup(ageCategory);
  if (!normalizedAgeCategory) {
    return null;
  }
  const count = YEARS_IN_CATEGORY_COUNT[normalizedAgeCategory];
  if (!count) {
    return null;
  }
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

export function createYearInCategory(value: unknown, ageCategory: unknown): string {
  const yearInCategory = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!yearInCategory) {
    return "";
  }

  const allowed = getValidYearsInCategory(ageCategory);
  if (allowed && !allowed.includes(yearInCategory)) {
    throw new Error("Année dans la catégorie invalide pour cette catégorie d'âge.");
  }
  return yearInCategory;
}

export function createHandedness(value: unknown): string {
  const handedness = typeof value === "string" ? value.trim() : "";
  if (!handedness) {
    return "";
  }
  if (!(HANDEDNESSES as readonly string[]).includes(handedness)) {
    throw new Error("Latéralité invalide pour un judoka.");
  }
  return handedness;
}
