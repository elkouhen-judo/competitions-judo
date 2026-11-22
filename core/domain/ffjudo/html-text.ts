const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç"
};

/** Décode les entités HTML courantes (nommées et numériques). */
export function decodeHtmlEntities(value: string): string {
  return String(value || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match: string, entity: string) => {
    if (entity.startsWith("#")) {
      const code = entity.startsWith("#x") || entity.startsWith("#X") ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Texte lisible d'un fragment HTML : balises retirées, entités décodées, espaces réduits. */
export function cleanHtmlText(value: string): string {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}
