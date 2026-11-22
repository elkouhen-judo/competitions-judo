import { parseLiguePage } from "../domain/ffjudo/ligue-page-parser";
import { parseNationalPage, NATIONAL_HOST } from "../domain/ffjudo/national-page-parser";
import { resolveLigue } from "../domain/ffjudo/ligues";
import type { FfjudoEvent } from "../domain/ffjudo/types";
import type { FfjudoEventsRepository } from "../repositories/ffjudo-events.repository";
import type { FfjudoEventRow, FfjudoSyncRunRow } from "../repositories/types";

/** Agenda FFJDA : pages lues à chaque synchronisation (aucune URL `?mois=` ni `/recherches`). */
export const LIGUE_SOURCES: readonly string[] = [
  "https://pays-de-la-loire-judo.ffjudo.com/evenement",
  "https://judo-bretagne.ffjudo.com/evenement",
  "https://nouvelle-aquitaine-judo.ffjudo.com/evenement"
];
export const NATIONAL_FIRST_PAGE = "https://www.ffjudo.com/evenements/agenda/1";
export const MAX_NATIONAL_PAGES = 10;
export const REQUEST_DELAY_MS = 1000;
/** Au-delà, plus aucune page n'est lue : la fonction Vercel (60 s) doit pouvoir journaliser. */
export const SYNC_BUDGET_MS = 40000;

type SourceStatus = { status: "ok" | "error"; count: number; error?: string };

export interface FfjudoSyncReport {
  status: "ok" | "partial" | "error";
  eventCount: number;
  sources: Record<string, SourceStatus>;
  /** Échec d'écriture en base, le cas échéant. */
  error?: string;
}

export interface FfjudoSyncDeps {
  repository: FfjudoEventsRepository;
  /** Lève si le statut HTTP n'est pas 2xx. */
  fetchText: (url: string) => Promise<string>;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
}

function nationalPageUrl(page: number): string {
  return `https://www.ffjudo.com/evenements/agenda/${page}`;
}

/** Date du jour à Paris, au format YYYY-MM-DD. */
function parisDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(date);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Fusionne deux lectures d'un même événement : sources réunies, premiers champs non vides gardés. */
function mergeEvents(first: FfjudoEvent, second: FfjudoEvent): FfjudoEvent {
  const merged: FfjudoEvent = { ...first, sources: [...new Set([...first.sources, ...second.sources])] };
  for (const key of Object.keys(first) as (keyof FfjudoEvent)[]) {
    if (key !== "sources" && !merged[key] && second[key]) {
      (merged as unknown as Record<string, unknown>)[key] = second[key];
    }
  }
  return merged;
}

/** Ville comparable : majuscules sans accents ni parenthèses (« FONTAINE (38600) » → « FONTAINE »). */
function normalizeTown(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * AGD-005 : un événement national aussi publié par une ligue (même jour, même ville) n'est
 * listé qu'une fois, sous la fiche de la ligue, qui gagne la source nationale. La fusion n'a
 * lieu que si la correspondance est unique des deux côtés.
 */
export function mergeNationalIntoLigue(events: FfjudoEvent[]): FfjudoEvent[] {
  const isNational = (event: FfjudoEvent) => event.eventKey.startsWith("nat:");
  const keyOf = (event: FfjudoEvent) => {
    const town = normalizeTown(isNational(event) ? event.lieu || event.ville : event.ville || event.lieu);
    return town ? `${event.dateDebut}|${town}` : "";
  };
  const groups = new Map<string, { ligue: FfjudoEvent[]; national: FfjudoEvent[] }>();
  for (const event of events) {
    const key = keyOf(event);
    if (!key) continue;
    const group = groups.get(key) || { ligue: [], national: [] };
    (isNational(event) ? group.national : group.ligue).push(event);
    groups.set(key, group);
  }
  const absorbed = new Set<string>();
  const extraSources = new Map<string, string[]>();
  for (const { ligue, national } of groups.values()) {
    const [ligueEvent] = ligue;
    const [nationalEvent] = national;
    if (ligue.length === 1 && national.length === 1 && ligueEvent && nationalEvent) {
      absorbed.add(nationalEvent.eventKey);
      extraSources.set(ligueEvent.eventKey, nationalEvent.sources);
    }
  }
  return events
    .filter((event) => !absorbed.has(event.eventKey))
    .map((event) => {
      const extra = extraSources.get(event.eventKey);
      return extra ? { ...event, sources: [...new Set([...event.sources, ...extra])] } : event;
    });
}

function toRow(event: FfjudoEvent, syncedAt: string): FfjudoEventRow {
  return {
    event_key: event.eventKey,
    titre: event.titre,
    date_debut: event.dateDebut,
    date_fin: event.dateFin || null,
    inscription_ouverture: event.inscriptionOuverture || null,
    inscription_cloture: event.inscriptionCloture || null,
    type_evenement: event.typeEvenement,
    lieu: event.lieu,
    ville: event.ville,
    code_postal: event.codePostal,
    proprietaire: event.proprietaire,
    ligue: resolveLigue(event.proprietaire, event.sources[0] || ""),
    source_url: event.sourceUrl,
    site_web: event.siteWeb,
    sources: event.sources,
    synced_at: syncedAt
  };
}

export function createFfjudoSyncService({ repository, fetchText, sleep, now }: FfjudoSyncDeps) {
  async function runSync(): Promise<FfjudoSyncReport> {
    const startTime = now();
    const startedAt = startTime.toISOString();
    const sources: Record<string, SourceStatus> = {};
    const events = new Map<string, FfjudoEvent>();
    let requestCount = 0;

    // Une requête par seconde au plus vers ffjudo.com, et rien au-delà du budget de durée.
    async function politeFetch(url: string): Promise<string> {
      if (now().getTime() - startTime.getTime() > SYNC_BUDGET_MS) {
        throw new Error("Délai de synchronisation dépassé.");
      }
      if (requestCount > 0) {
        await sleep(REQUEST_DELAY_MS);
      }
      requestCount += 1;
      return fetchText(url);
    }

    function collect(found: FfjudoEvent[]) {
      for (const event of found) {
        const previous = events.get(event.eventKey);
        events.set(event.eventKey, previous ? mergeEvents(previous, event) : event);
      }
    }

    for (const url of LIGUE_SOURCES) {
      const host = new URL(url).host;
      try {
        const found = parseLiguePage(await politeFetch(url), host);
        if (!found.length) {
          throw new Error("Aucun événement lu : gabarit FFJDA non reconnu ?");
        }
        collect(found);
        sources[host] = { status: "ok", count: found.length };
      } catch (error) {
        sources[host] = { status: "error", count: 0, error: errorMessage(error) };
      }
    }

    let nationalCount = 0;
    try {
      const first = parseNationalPage(await politeFetch(NATIONAL_FIRST_PAGE));
      collect(first.events);
      nationalCount += first.events.length;
      const lastPage = Math.min(first.lastPage, MAX_NATIONAL_PAGES);
      for (let page = 2; page <= lastPage; page += 1) {
        const next = parseNationalPage(await politeFetch(nationalPageUrl(page)));
        collect(next.events);
        nationalCount += next.events.length;
      }
      if (!nationalCount) {
        throw new Error("Aucun événement lu : gabarit FFJDA non reconnu ?");
      }
      sources[NATIONAL_HOST] = { status: "ok", count: nationalCount };
    } catch (error) {
      sources[NATIONAL_HOST] = { status: "error", count: nationalCount, error: errorMessage(error) };
    }

    const statuses = Object.values(sources).map((source) => source.status);
    let status: FfjudoSyncReport["status"] = statuses.every((value) => value === "ok")
      ? "ok"
      : statuses.some((value) => value === "ok")
        ? "partial"
        : "error";

    const merged = mergeNationalIntoLigue([...events.values()]);
    let persistenceError = "";
    if (status !== "error") {
      try {
        await repository.upsertEvents(merged.map((event) => toRow(event, startedAt)));

        // Un événement à venir disparu n'est retiré que si toutes ses sources ont été lues.
        const kept = new Set(merged.map((event) => event.eventKey));
        const succeeded = (host: string) => sources[host]?.status === "ok";
        const existing = await repository.listFutureEventKeys(parisDate(now()));
        const vanished = existing
          .filter((row) => !kept.has(row.event_key))
          .filter((row) => (row.sources || []).every(succeeded))
          .map((row) => row.event_key);
        if (vanished.length) {
          await repository.deleteEvents(vanished);
        }
      } catch (error) {
        persistenceError = errorMessage(error);
        status = "error";
      }
    }

    const report: FfjudoSyncReport = {
      status,
      eventCount: status === "error" ? 0 : merged.length,
      sources,
      ...(persistenceError ? { error: persistenceError } : {})
    };
    // Le journal est écrit dans tous les cas, échec d'écriture compris.
    const run: FfjudoSyncRunRow = {
      started_at: startedAt,
      finished_at: now().toISOString(),
      status,
      sources: persistenceError
        ? { ...sources, _persistence: { status: "error", count: 0, error: persistenceError } }
        : sources,
      event_count: report.eventCount
    };
    await repository.insertRun(run);
    return report;
  }

  return { runSync };
}

export default createFfjudoSyncService;
