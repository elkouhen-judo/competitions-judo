import { cleanHtmlText } from "./html-text";
import type { FfjudoEvent } from "./types";

export const NATIONAL_HOST = "www.ffjudo.com";

const CARD_PATTERN = /<div class="card_evenement">([\s\S]*?)<div class="liens">/g;

/** « dd.mm.yyyy » → YYYY-MM-DD ; "" si le format est inattendu. */
function frenchDateToIso(value: string): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(cleanHtmlText(value));
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function firstGroup(pattern: RegExp, source: string): string {
  const match = pattern.exec(source);
  return match?.[1] ?? "";
}

function readLastPage(html: string): number {
  const lastLink = firstGroup(/<li class="page last">\s*<a href="[^"]*\/evenements\/agenda\/(\d+)"/, html);
  const pages = [...html.matchAll(/\/evenements\/agenda\/(\d+)"/g)].map((match) => Number(match[1]));
  const lastPage = Number(lastLink) || Math.max(1, ...pages);
  return Number.isFinite(lastPage) && lastPage > 0 ? lastPage : 1;
}

function toEvent(card: string): FfjudoEvent | null {
  const sourceUrl = firstGroup(/<a href="(https:\/\/www\.ffjudo\.com\/evenement\/[^"]+)"/, card);
  const slug = sourceUrl.split("/evenement/")[1] || "";
  const titre = cleanHtmlText(firstGroup(/<h2 class="nom">([\s\S]*?)<\/h2>/, card));
  const dateDebut = frenchDateToIso(firstGroup(/<span class="start">([^<]*)<\/span>/, card));
  if (!slug || !titre || !dateDebut) {
    return null;
  }
  const dateFin = frenchDateToIso(firstGroup(/<span class="(?:finish|end)">([^<]*)<\/span>/, card));
  return {
    eventKey: `nat:${slug}:${dateDebut}`,
    titre,
    dateDebut,
    dateFin: dateFin === dateDebut ? "" : dateFin,
    inscriptionOuverture: "",
    inscriptionCloture: "",
    typeEvenement: "",
    lieu: cleanHtmlText(firstGroup(/<div class="lieux">[\s\S]*?<span>([\s\S]*?)<\/span>/, card)),
    ville: "",
    codePostal: "",
    proprietaire: "",
    sourceUrl,
    siteWeb: "",
    sources: [NATIONAL_HOST]
  };
}

/** Agenda FFJDA : lit une page `https://www.ffjudo.com/evenements/agenda/N` (cartes + pagination). */
export function parseNationalPage(html: string): { events: FfjudoEvent[]; lastPage: number } {
  const source = String(html || "");
  const events = [...source.matchAll(CARD_PATTERN)]
    .map((match) => toEvent(match[1] ?? ""))
    .filter((event): event is FfjudoEvent => event !== null);
  // Une pagination sans aucune carte signale un gabarit changé, pas un agenda vide.
  if (!events.length && /class="pagination-listing"/.test(source)) {
    throw new Error("Gabarit FFJDA non reconnu : aucune carte d'événement sur la page nationale.");
  }
  return { events, lastPage: readLastPage(source) };
}

export default parseNationalPage;
