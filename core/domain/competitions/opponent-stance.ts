export type OpponentStance = "" | "Droitier" | "Gaucher";

const OPPONENT_STANCE_ALIASES = new Map<string, OpponentStance>([
  ["droitier", "Droitier"],
  ["droite", "Droitier"],
  ["gaucher", "Gaucher"],
  ["gauche", "Gaucher"]
]);

function normalizeOpponentStanceKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function normalizeOpponentStance(value: unknown): OpponentStance {
  return OPPONENT_STANCE_ALIASES.get(normalizeOpponentStanceKey(value)) || "";
}

export function createOpponentStance(value: unknown): OpponentStance {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  const stance = normalizeOpponentStance(rawValue);
  if (!stance) {
    throw new Error("Garde de l'adversaire invalide.");
  }
  return stance;
}
