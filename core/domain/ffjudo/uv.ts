/** Agenda FFJDA (AGD-012) : UV proposées par une séance de passage de grade, lues dans son titre. */

export type Uv = "UV1" | "UV2" | "UV3" | "UV4";

const GRADE_TYPE = "PASSAGE DE GRADE";
// « UV1/2/3b », « UV1-UV2 », « UV1 /UV2 », « UV 3 » : un numéro, puis d'éventuels numéros enchaînés.
const UV_LIST = /\bUV\s*([1-4])((?:\s*[/,-]\s*(?:UV\s*)?[1-4][AB]?\b)*)/g;
// L'UV3 (efficacité combat) est aussi annoncée sans son numéro.
const UV3_ALIASES = /\bTEC\b|EFFICACITE COMBAT|\bSHIAI\b/;

function normalize(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

/** UV détectées, triées et sans doublon ; une séance de préparation (« stage ») n'en a aucune. */
export function detectUvs(titre: string, typeEvenement: string): Uv[] {
  const title = normalize(titre);
  const isGradeSession = normalize(typeEvenement) === GRADE_TYPE;
  if (/\bSTAGE\b/.test(title) || (!isGradeSession && !/\bUV\s*[1-4]/.test(title))) {
    return [];
  }
  const found = new Set<string>();
  for (const match of title.matchAll(UV_LIST)) {
    found.add(`UV${match[1]}`);
    for (const digit of (match[2] ?? "").match(/[1-4]/g) ?? []) {
      found.add(`UV${digit}`);
    }
  }
  if (isGradeSession && UV3_ALIASES.test(title)) {
    found.add("UV3");
  }
  return [...found].sort() as Uv[];
}

export default detectUvs;
