export type NeWazaType =
  | "Hon-gesa-gatame"
  | "Kuzure-kesa-gatame"
  | "Yoko-shiho-gatame"
  | "Tate-shiho-gatame"
  | "Kami-shiho-gatame"
  | "Juji-gatame"
  | "Ude-garami"
  | "Hadaka-jime"
  | "Okuri-eri-jime"
  | "Kata-juji-jime";

export const NE_WAZA_TYPES: NeWazaType[] = [
  "Hon-gesa-gatame",
  "Kuzure-kesa-gatame",
  "Yoko-shiho-gatame",
  "Tate-shiho-gatame",
  "Kami-shiho-gatame",
  "Juji-gatame",
  "Ude-garami",
  "Hadaka-jime",
  "Okuri-eri-jime",
  "Kata-juji-jime"
];

const NE_WAZA_TYPE_ALIASES = new Map<string, NeWazaType>([
  ["hon gesa gatame", "Hon-gesa-gatame"],
  ["hongesa gatame", "Hon-gesa-gatame"],
  ["hon-gesa-gatame", "Hon-gesa-gatame"],
  ["kuzure kesa gatame", "Kuzure-kesa-gatame"],
  ["kuzure-kesa-gatame", "Kuzure-kesa-gatame"],
  ["yoko shiho gatame", "Yoko-shiho-gatame"],
  ["yoko-shiho-gatame", "Yoko-shiho-gatame"],
  ["tate shiho gatame", "Tate-shiho-gatame"],
  ["tate-shiho-gatame", "Tate-shiho-gatame"],
  ["kami shiho gatame", "Kami-shiho-gatame"],
  ["kami-shiho-gatame", "Kami-shiho-gatame"],
  ["juji gatame", "Juji-gatame"],
  ["juji-gatame", "Juji-gatame"],
  ["ude garami", "Ude-garami"],
  ["ude-garami", "Ude-garami"],
  ["hadaka jime", "Hadaka-jime"],
  ["hadaka-jime", "Hadaka-jime"],
  ["okuri eri jime", "Okuri-eri-jime"],
  ["okuri-eri-jime", "Okuri-eri-jime"],
  ["kata juji jime", "Kata-juji-jime"],
  ["kata-juji-jime", "Kata-juji-jime"],
  ["cle", "Juji-gatame"],
  ["cle de bras", "Juji-gatame"],
  ["etranglement", "Hadaka-jime"],
  ["osaekomi", "Hon-gesa-gatame"],
  ["immobilisation", "Hon-gesa-gatame"]
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
    throw new Error("Action au sol invalide.");
  }
  return neWazaType;
}
