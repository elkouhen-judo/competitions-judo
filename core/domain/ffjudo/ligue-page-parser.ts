import { cleanHtmlText } from "./html-text";
import type { FfjudoEvent } from "./types";

const EMBEDDED_MARKER = "name=\"evenements\" value='";

/** Levée quand la page ne ressemble plus au gabarit connu : la source compte alors en échec. */
export const UNRECOGNISED_TEMPLATE = "Gabarit FFJDA non reconnu";

/** Champs du JSON FFJDA lus par l'analyseur ; les contacts n'y figurent volontairement pas. */
interface RawLigueEvent {
  id_evenement?: unknown;
  id?: unknown;
  type?: unknown;
  slug?: unknown;
  titre?: unknown;
  lieu?: unknown;
  ville?: unknown;
  codePostal?: unknown;
  date_debut?: unknown;
  date_fin?: unknown;
  dateOuverture?: unknown;
  dateCloture?: unknown;
  libelleType?: unknown;
  proprietaire?: unknown;
  siteWeb?: unknown;
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : cleanHtmlText(String(value));
}

/** Horodatage Unix (secondes, minuit UTC chez la FFJDA) → YYYY-MM-DD ; "" si vide ou invalide. */
export function unixToIsoDate(value: unknown): string {
  const seconds = Number(String(value ?? "").trim());
  if (!String(value ?? "").trim() || !Number.isFinite(seconds) || seconds <= 0) {
    return "";
  }
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

/** Extrait le texte JSON qui commence à `start` en équilibrant accolades et crochets hors chaînes. */
function extractJsonValue(source: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{" || char === "[") {
      depth += 1;
    } else if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  return "";
}

function flatten(calendar: unknown): RawLigueEvent[] {
  if (!calendar || typeof calendar !== "object") {
    return [];
  }
  const events: RawLigueEvent[] = [];
  for (const months of Object.values(calendar as Record<string, unknown>)) {
    if (!months || typeof months !== "object") continue;
    for (const list of Object.values(months as Record<string, unknown>)) {
      if (Array.isArray(list)) events.push(...(list as RawLigueEvent[]));
    }
  }
  return events;
}

function buildKey(raw: RawLigueEvent, host: string): string {
  const federalId = text(raw.id);
  if (text(raw.type) === "federal" && federalId) {
    return `fed:${federalId}`;
  }
  return `loc:${host}:${text(raw.id_evenement)}`;
}

function toEvent(raw: RawLigueEvent, host: string): FfjudoEvent | null {
  const titre = text(raw.titre);
  const dateDebut = unixToIsoDate(raw.date_debut);
  const siteId = text(raw.id_evenement);
  if (!titre || !dateDebut || !siteId) {
    return null;
  }
  const dateFin = unixToIsoDate(raw.date_fin);
  return {
    eventKey: buildKey(raw, host),
    titre,
    dateDebut,
    dateFin: dateFin === dateDebut ? "" : dateFin,
    inscriptionOuverture: unixToIsoDate(raw.dateOuverture),
    inscriptionCloture: unixToIsoDate(raw.dateCloture),
    typeEvenement: text(raw.libelleType),
    lieu: text(raw.lieu),
    ville: text(raw.ville),
    codePostal: text(raw.codePostal),
    proprietaire: text(raw.proprietaire),
    sourceUrl: `https://${host}/evenement/${encodeURIComponent(text(raw.slug))}/${encodeURIComponent(siteId)}`,
    siteWeb: text(raw.siteWeb),
    sources: [host]
  };
}

/**
 * Agenda FFJDA : lit le calendrier JSON intégré au formulaire d'export d'une page
 * `https://<ligue>.ffjudo.com/evenement`. Les champs de contact ne sont jamais copiés.
 * Lève une erreur « Gabarit FFJDA non reconnu » si le calendrier intégré est absent ou illisible.
 */
export function parseLiguePage(html: string, host: string): FfjudoEvent[] {
  const source = String(html || "");
  const markerIndex = source.indexOf(EMBEDDED_MARKER);
  if (markerIndex < 0) {
    throw new Error(`${UNRECOGNISED_TEMPLATE} : calendrier intégré absent (${host}).`);
  }
  const json = extractJsonValue(source, markerIndex + EMBEDDED_MARKER.length);
  let calendar: unknown;
  try {
    calendar = JSON.parse(json);
  } catch {
    throw new Error(`${UNRECOGNISED_TEMPLATE} : calendrier intégré illisible (${host}).`);
  }
  return flatten(calendar)
    .map((raw) => toEvent(raw, host))
    .filter((event): event is FfjudoEvent => event !== null);
}

export default parseLiguePage;
