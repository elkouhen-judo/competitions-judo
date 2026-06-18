export type NeWazaType = "Clé" | "Étranglement" | "Osaekomi";

export const NE_WAZA_TYPES: NeWazaType[] = ["Clé", "Étranglement", "Osaekomi"];

const NE_WAZA_TYPE_ALIASES = new Map<string, NeWazaType>([
  ["cle", "Clé"],
  ["cle de bras", "Clé"],
  ["etranglement", "Étranglement"],
  ["osaekomi", "Osaekomi"],
  ["immobilisation", "Osaekomi"]
]);

function normalizeNeWazaTypeKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function normalizeNeWazaType(value: unknown): NeWazaType | "" {
  return NE_WAZA_TYPE_ALIASES.get(normalizeNeWazaTypeKey(value)) || "";
}

export function createNeWazaType(value: unknown): NeWazaType | "" {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  const neWazaType = normalizeNeWazaType(rawValue);
  if (!neWazaType) {
    throw new Error("Type de prise Ne-waza invalide.");
  }
  return neWazaType;
}
