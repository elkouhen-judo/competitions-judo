// Couleurs de ceinture proposées dans l'application. Les données importées ou saisies
// avec une autre casse (« marron », « NOIR 1ER DAN ») sont ramenées à cette forme pour
// que le formulaire de profil retrouve toujours la valeur enregistrée.
export const BELT_COLORS = [
  "Blanc",
  "Blanc-Jaune",
  "Jaune",
  "Jaune-Orange",
  "Orange",
  "Orange-Vert",
  "Vert",
  "Vert-Bleu",
  "Bleu",
  "Bleu-Marron",
  "Marron",
  "Noir 1er Dan",
  "Noir 2e Dan",
  "Noir 3e Dan",
  "Noir 4e Dan",
  "Noir 5e Dan"
] as const;

function toBeltKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const BELT_COLORS_BY_KEY = new Map(BELT_COLORS.map((belt) => [toBeltKey(belt), belt]));

/** Renvoie la forme canonique d'une couleur connue, ou la valeur nettoyée sinon. */
export function normalizeBeltColor(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return BELT_COLORS_BY_KEY.get(toBeltKey(raw)) || raw;
}
