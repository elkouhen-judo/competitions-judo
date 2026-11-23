import { detectAgeCategory, detectCompetitionLevel } from "../domain/ffjudo/competition-prefill";
import { detectGrades } from "../domain/ffjudo/grade";
import { detectUvs } from "../domain/ffjudo/uv";
import type { FfjudoEventsRepository } from "../repositories/ffjudo-events.repository";
import type { FfjudoEventRow, JudokaRow } from "../repositories/types";
import type { UserContextService } from "./user-context.service";
import type { FfjudoAgenda, FfjudoAgendaEvent, RpcMethods } from "../types";

export interface FfjudoAgendaServiceDeps {
  repository: Pick<FfjudoEventsRepository, "listUpcoming" | "getLastSuccessfulRun">;
  userContextService: Pick<UserContextService, "getIdentity">;
  /** AGD-001 : l'agenda est réservé aux coachs. */
  isCoach: (user: JudokaRow) => boolean;
  now: () => Date;
}

/** Date du jour à Paris, au format YYYY-MM-DD. */
function parisDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(date);
}

function toAgendaEvent(row: FfjudoEventRow): FfjudoAgendaEvent {
  const uvs = detectUvs(String(row.titre || ""), String(row.type_evenement || ""));
  return {
    eventKey: String(row.event_key || ""),
    titre: String(row.titre || ""),
    dateDebut: String(row.date_debut || ""),
    dateFin: String(row.date_fin || ""),
    inscriptionCloture: String(row.inscription_cloture || ""),
    typeEvenement: String(row.type_evenement || ""),
    lieu: String(row.lieu || ""),
    ville: String(row.ville || ""),
    ligue: String(row.ligue || ""),
    proprietaire: String(row.proprietaire || ""),
    sourceUrl: String(row.source_url || ""),
    uvs,
    grades: detectGrades(String(row.titre || ""), uvs),
    suggestedLevel: detectCompetitionLevel(String(row.proprietaire || ""), String(row.ligue || "")),
    suggestedAgeCategory: detectAgeCategory(String(row.titre || ""))
  };
}

/** Agenda FFJDA : lecture des événements à venir, réservée aux coachs (AGD-001). */
export default function createFfjudoAgendaService({
  repository,
  userContextService,
  isCoach,
  now
}: FfjudoAgendaServiceDeps) {
  async function getFfjudoEvents(email: string): Promise<FfjudoAgenda> {
    const identity = await userContextService.getIdentity(email);
    if (!identity || !isCoach(identity.user)) {
      throw new Error("Accès refusé.");
    }
    const [rows, lastRun] = await Promise.all([
      repository.listUpcoming(parisDate(now())),
      repository.getLastSuccessfulRun()
    ]);
    return {
      events: rows.map(toAgendaEvent),
      lastSyncAt: lastRun ? String(lastRun.finished_at || "") : ""
    };
  }

  const methods: Pick<RpcMethods, "getFfjudoEvents"> = { getFfjudoEvents };
  return { methods };
}
