export type NeWazaType = string;

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
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[-\s]+/g, " ");
}

export function normalizeNeWazaType(value: unknown): NeWazaType | "" {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }
  return NE_WAZA_TYPE_ALIASES.get(normalizeNeWazaTypeKey(rawValue)) || rawValue;
}

export function createNeWazaType(value: unknown): NeWazaType | "" {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "";
  }

  return normalizeNeWazaType(rawValue);
}
