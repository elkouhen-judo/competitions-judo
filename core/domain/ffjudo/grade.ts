/** Agenda FFJDA (AGD-015) : grades (dan) visés par une séance d'UV, lus dans son titre. */

const ORDINAL = "(?:\\s*(?:IEME|EME|ERE|ER|E))?";
// « DU 1ER AU 4EME DAN », « 1ER A 4EME DAN » : tous les dans de la plage.
const DAN_RANGE = new RegExp(`\\b([1-6])${ORDINAL}\\s+AU?\\s+([1-6])${ORDINAL}\\s+DAN\\b`, "g");
// « 1ER DAN », « 1ER/2EME DAN », « 1ER & 2EME DAN », « 1ER,2IEME ET 3IEME DAN ».
const DAN_LIST = new RegExp(
  `\\b([1-6])${ORDINAL}((?:\\s*(?:[/,&+-]|\\bET\\b)\\s*[1-6]${ORDINAL})*)\\s+DAN\\b`,
  "g"
);
// « 1D, 2D & 3D » : abréviation du dan.
const DAN_SHORT = /\b([1-6])D\b/g;
const JAPANESE_DANS: Record<string, number> = { SHODAN: 1, NIDAN: 2, SANDAN: 3, YONDAN: 4, GODAN: 5, ROKUDAN: 6 };

function normalize(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

/** Dans de 1 à 6, triés et sans doublon ; seulement pour une séance qui porte des UV. */
export function detectGrades(titre: string, uvs: readonly string[]): number[] {
  if (!uvs.length) {
    return [];
  }
  const title = normalize(titre);
  const found = new Set<number>();
  for (const match of title.matchAll(DAN_RANGE)) {
    const [from, to] = [Number(match[1]), Number(match[2])].sort((a, b) => a - b);
    for (let dan = from; dan <= to; dan += 1) found.add(dan);
  }
  for (const match of title.matchAll(DAN_LIST)) {
    found.add(Number(match[1]));
    for (const digit of (match[2] ?? "").match(/[1-6]/g) ?? []) found.add(Number(digit));
  }
  for (const match of title.matchAll(DAN_SHORT)) {
    found.add(Number(match[1]));
  }
  for (const [word, dan] of Object.entries(JAPANESE_DANS)) {
    if (new RegExp(`\\b${word}\\b`).test(title)) found.add(dan);
  }
  return [...found].sort((a, b) => a - b);
}

export default detectGrades;
