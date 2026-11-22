import { inFilter, uniqueIds } from "../shared/query";
import type { FfjudoEventRow, FfjudoSyncRunRow, SupabaseRestDeps } from "./types";

const EVENTS_TABLE = "ffjudo_events";
const RUNS_TABLE = "ffjudo_sync_runs";
const DELETE_BATCH_SIZE = 100;
const EVENT_COLUMNS =
  "event_key,titre,date_debut,date_fin,inscription_ouverture,inscription_cloture,type_evenement,lieu,ville,code_postal,proprietaire,ligue,source_url,site_web,sources,synced_at";

export interface FfjudoEventsRepository {
  upsertEvents(rows: FfjudoEventRow[]): Promise<void>;
  listFutureEventKeys(fromDate: string): Promise<{ event_key: string; sources: string[] }[]>;
  deleteEvents(eventKeys: string[]): Promise<void>;
  listUpcoming(fromDate: string): Promise<FfjudoEventRow[]>;
  insertRun(run: FfjudoSyncRunRow): Promise<void>;
  getLastSuccessfulRun(): Promise<FfjudoSyncRunRow | null>;
}

export default function createFfjudoEventsRepository(deps: SupabaseRestDeps): FfjudoEventsRepository {
  const { supabaseDelete, supabaseInsert, supabaseSelect, supabaseSelectOne, supabaseUpsertMany } = deps;

  async function upsertEvents(rows: FfjudoEventRow[]): Promise<void> {
    if (!supabaseUpsertMany) {
      throw new Error("Écriture groupée Supabase indisponible.");
    }
    await supabaseUpsertMany(EVENTS_TABLE, rows, "event_key");
  }

  async function listFutureEventKeys(fromDate: string): Promise<{ event_key: string; sources: string[] }[]> {
    return supabaseSelect<{ event_key: string; sources: string[] }>(
      EVENTS_TABLE,
      `select=event_key,sources&date_debut=gte.${encodeURIComponent(fromDate)}&order=event_key.asc`
    );
  }

  // PERF-004 : les identifiants partent par lots de 100.
  async function deleteEvents(eventKeys: string[]): Promise<void> {
    const keys = uniqueIds(eventKeys);
    for (let start = 0; start < keys.length; start += DELETE_BATCH_SIZE) {
      await supabaseDelete(EVENTS_TABLE, inFilter("event_key", keys.slice(start, start + DELETE_BATCH_SIZE)));
    }
  }

  async function listUpcoming(fromDate: string): Promise<FfjudoEventRow[]> {
    return supabaseSelect<FfjudoEventRow>(
      EVENTS_TABLE,
      `select=${EVENT_COLUMNS}&date_debut=gte.${encodeURIComponent(fromDate)}&order=date_debut.asc,titre.asc,event_key.asc`
    );
  }

  async function insertRun(run: FfjudoSyncRunRow): Promise<void> {
    await supabaseInsert<FfjudoSyncRunRow>(RUNS_TABLE, run);
  }

  async function getLastSuccessfulRun(): Promise<FfjudoSyncRunRow | null> {
    return supabaseSelectOne<FfjudoSyncRunRow>(
      RUNS_TABLE,
      "select=started_at,finished_at,status,sources,event_count&status=in.(ok,partial)&order=finished_at.desc"
    );
  }

  return { upsertEvents, listFutureEventKeys, deleteEvents, listUpcoming, insertRun, getLastSuccessfulRun };
}
