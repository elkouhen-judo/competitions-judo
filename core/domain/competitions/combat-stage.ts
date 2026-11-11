// Étape du combat dans le déroulé de la compétition (facultative).
export type CombatStage =
  | ""
  | "Poule"
  | "1/32"
  | "1/16"
  | "1/8"
  | "1/4"
  | "1/2"
  | "Finale"
  | "Repêchage"
  | "Place de 3";

// Ordre chronologique d'un tableau de judo : poules, tableau final, repêchages, puis podium.
export const COMBAT_STAGES: Exclude<CombatStage, "">[] = [
  "Poule",
  "1/32",
  "1/16",
  "1/8",
  "1/4",
  "1/2",
  "Repêchage",
  "Place de 3",
  "Finale"
];

const COMBAT_STAGE_ALIASES = new Map<string, CombatStage>([
  ["poule", "Poule"],
  ["poules", "Poule"],
  ["1/32", "1/32"],
  ["1/16", "1/16"],
  ["1/8", "1/8"],
  ["huitieme", "1/8"],
  ["1/4", "1/4"],
  ["quart", "1/4"],
  ["1/2", "1/2"],
  ["demi", "1/2"],
  ["demi-finale", "1/2"],
  ["finale", "Finale"],
  ["repechage", "Repêchage"],
  ["place de 3", "Place de 3"],
  ["place de 3e", "Place de 3"],
  ["bronze", "Place de 3"]
]);

function normalizeCombatStageKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+de\s+finale$/u, "")
    .replace(/\s+/g, " ");
}

export function normalizeCombatStage(value: unknown): CombatStage {
  return COMBAT_STAGE_ALIASES.get(normalizeCombatStageKey(value)) || "";
}

export function createCombatStage(value: unknown): CombatStage {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }
  const stage = normalizeCombatStage(rawValue);
  if (!stage) {
    throw new Error("Étape du combat invalide.");
  }
  return stage;
}

export function getCombatStageOrder(stage: unknown): number {
  const index = COMBAT_STAGES.indexOf(normalizeCombatStage(stage) as Exclude<CombatStage, "">);
  return index === -1 ? COMBAT_STAGES.length : index;
}
