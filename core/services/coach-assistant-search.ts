import { DEFAULT_LIMIT, MAX_LIMIT } from "./coach-mcp-tools";
import type { CombatRow, CombatScoreRow, CompetitionRow, JudokaRow } from "../repositories/types";
import { normalizeNeWazaType } from "../domain/competitions/ne-waza-type";
import type { CoachAssistantMatch, CoachChatFilters } from "../types";

// Recherche structurée de combats exposée au serveur MCP (outil mcp_combats_search).
// Le chat coach en langage naturel a été retiré : ce module ne fait plus appel à un LLM.

export interface CoachChatDatasets {
  combatRows: CombatRow[];
  competitionRows: CompetitionRow[];
  judokaRows: JudokaRow[];
  scoresByCombatId: Map<string, CombatScoreRow[]>;
}

type CoachChatEntity = "judokas" | "combats" | "competitions";

interface CoachChatQuery {
  entity: CoachChatEntity;
  filters: CoachChatFilters;
  limit: number;
}

export interface CoachAssistantSearchDeps {
  getCurrentDate: () => string;
}

export interface CoachAssistantSearch {
  searchCombats(
    filters: CoachChatFilters,
    limit: number | undefined,
    datasets: CoachChatDatasets
  ): { matches: CoachAssistantMatch[] };
}

export function createCoachAssistantSearch(deps: CoachAssistantSearchDeps): CoachAssistantSearch {
  const { getCurrentDate } = deps;

  function searchCombats(
    filters: CoachChatFilters = {},
    limit: number | undefined,
    datasets: CoachChatDatasets
  ): { matches: CoachAssistantMatch[] } {
    const query = buildCoachChatQuery({
      entity: "combats",
      filters: filters as Record<string, unknown>,
      limit
    }) as CoachChatQuery;
    return { matches: executeCoachChatQuery(query, datasets).matches };
  }

  function resolveRelativeDates(query: CoachChatQuery | null): CoachChatQuery | null {
    if (!query || query.filters.competitionDate !== "today") {
      return query;
    }
    return {
      ...query,
      filters: {
        ...query.filters,
        competitionDate: getCurrentDate()
      }
    };
  }

  function buildCoachChatQuery(
    parsed:
      | {
          entity?: unknown;
          filters?: Record<string, unknown>;
          limit?: unknown;
        }
      | null
      | undefined
  ): CoachChatQuery | null {
    return resolveRelativeDates(buildCoachChatQueryWithoutDateResolution(parsed));
  }

  return { searchCombats };
}

function normalizeAssistantText(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function normalizeAssistantSearchText(value: unknown): string {
  return normalizeAssistantText(value).replace(/[^\p{Letter}\p{Number}]+/gu, " ");
}

function buildCoachChatQueryWithoutDateResolution(
  parsed:
    | {
        entity?: unknown;
        filters?: Record<string, unknown>;
        limit?: unknown;
      }
    | null
    | undefined
): CoachChatQuery | null {
  const entity = parsed?.entity;
  if (entity !== "judokas" && entity !== "combats" && entity !== "competitions") {
    return null;
  }
  const filters = parsed?.filters && typeof parsed.filters === "object" ? parsed.filters : {};
  const text = (Array.isArray(filters.text) ? filters.text : [filters.text])
    .map((term: unknown) => String(term || "").trim())
    .filter(Boolean);
  const normalizedFilters: CoachChatFilters = {
    ageCategory: String(filters.ageCategory || "").trim() || undefined,
    beltColor: String(filters.beltColor || "").trim() || undefined,
    categoryYear: String(filters.categoryYear || "").trim() || undefined,
    competitionDate: String(filters.competitionDate || "").trim() || undefined,
    competitionLevel: String(filters.competitionLevel || "").trim() || undefined,
    gender: String(filters.gender || "").trim() || undefined,
    handedness: String(filters.handedness || "").trim() || undefined,
    neWazaType: normalizeNeWazaType(filters.neWazaType) || undefined,
    opponent: String(filters.opponent || "").trim() || undefined,
    opponentStance: String(filters.opponentStance || "").trim() || undefined,
    result: String(filters.result || "").trim() || undefined,
    scoreValue: String(filters.scoreValue || "").trim() || undefined,
    tachiWazaTechnique: String(filters.tachiWazaTechnique || "").trim() || undefined,
    victoryType: String(filters.victoryType || "").trim() || undefined,
    text
  };
  return {
    entity,
    filters: normalizedFilters,
    limit: Math.min(Math.max(Number(parsed?.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT)
  };
}

function executeCoachChatQuery(
  query: CoachChatQuery,
  datasets: CoachChatDatasets
): { matches: CoachAssistantMatch[] } {
  const { judokaRows, competitionRows, combatRows, scoresByCombatId } = datasets;
  const competitionsById = new Map(
    competitionRows.map((competition) => [String(competition.id_competition), competition])
  );
  const judokasById = new Map(judokaRows.map((judoka) => [String(judoka.id_judoka), judoka]));
  return {
    matches: searchCoachCombats(query, combatRows, judokasById, competitionsById, scoresByCombatId)
  };
}

function searchCoachCombats(
  query: CoachChatQuery,
  combatRows: CombatRow[],
  judokasById: Map<string, JudokaRow>,
  competitionsById: Map<string, CompetitionRow>,
  scoresByCombatId: Map<string, CombatScoreRow[]>
): CoachAssistantMatch[] {
  return combatRows
    .filter((combat) =>
      matchesCombatFilters(
        combat,
        scoresByCombatId.get(String(combat.id_combat)) || [],
        judokasById.get(String(combat.id_judoka)),
        competitionsById.get(String(combat.id_competition)),
        query
      )
    )
    .map((combat) =>
      toAssistantMatch(
        judokasById.get(String(combat.id_judoka)),
        combat,
        competitionsById.get(String(combat.id_competition)),
        scoresByCombatId.get(String(combat.id_combat)) || []
      )
    )
    .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate))
    .slice(0, query.limit);
}

function matchesJudokaFilters(judoka: JudokaRow | undefined, query: CoachChatQuery): boolean {
  if (!judoka) {
    return false;
  }
  if (
    query.filters.ageCategory &&
    String(judoka.categorie_age || "") !== query.filters.ageCategory
  ) {
    return false;
  }
  if (
    query.filters.beltColor &&
    String(judoka.couleur_ceinture || "") !== query.filters.beltColor
  ) {
    return false;
  }
  if (
    query.filters.categoryYear &&
    String(judoka.annee_categorie || "") !== query.filters.categoryYear
  ) {
    return false;
  }
  if (query.filters.gender && String(judoka.genre || "") !== query.filters.gender) {
    return false;
  }
  if (query.filters.handedness && String(judoka.lateralite || "") !== query.filters.handedness) {
    return false;
  }
  const judokaTextTerms = query.filters.text || [];
  if (judokaTextTerms.length) {
    const searchText = normalizeAssistantSearchText(
      [judoka.prenom, judoka.nom, judoka.categorie_age, judoka.couleur_ceinture].join(" ")
    );
    if (
      !judokaTextTerms.every((term) =>
        searchText.includes(normalizeAssistantSearchText(term).trim())
      )
    ) {
      return false;
    }
  }
  return true;
}

function matchesCompetitionFilters(
  competition: CompetitionRow | undefined,
  query: CoachChatQuery
): boolean {
  if (!competition) {
    return false;
  }
  if (
    query.filters.competitionDate &&
    String(competition.date || "") !== query.filters.competitionDate
  ) {
    return false;
  }
  if (
    query.filters.competitionLevel &&
    String(competition.niveau || "") !== query.filters.competitionLevel
  ) {
    return false;
  }
  return true;
}

function matchesCombatFilters(
  combat: CombatRow,
  scores: CombatScoreRow[],
  judoka: JudokaRow | undefined,
  competition: CompetitionRow | undefined,
  query: CoachChatQuery
): boolean {
  if (!matchesJudokaFilters(judoka, query)) {
    return false;
  }
  if (!matchesCompetitionFilters(competition, query)) {
    return false;
  }
  if (query.filters.result && String(combat.resultat || "") !== query.filters.result) {
    return false;
  }
  if (
    query.filters.victoryType &&
    String(combat.type_victoire || "") !== query.filters.victoryType
  ) {
    return false;
  }
  if (
    query.filters.opponentStance &&
    String(combat.garde_adversaire || "") !== query.filters.opponentStance
  ) {
    return false;
  }
  if (
    query.filters.opponent &&
    !normalizeAssistantSearchText(combat.adversaire).includes(
      normalizeAssistantSearchText(query.filters.opponent)
    )
  ) {
    return false;
  }
  if (
    query.filters.neWazaType &&
    !scores.some((score) => scoreMatchesNeWazaType(score, query.filters.neWazaType || ""))
  ) {
    return false;
  }
  if (
    query.filters.tachiWazaTechnique &&
    !scores.some((score) => String(score.technique || "") === query.filters.tachiWazaTechnique)
  ) {
    return false;
  }
  if (
    query.filters.scoreValue &&
    !scores.some((score) => String(score.valeur || "") === query.filters.scoreValue)
  ) {
    return false;
  }
  const textTerms = query.filters.text || [];
  if (textTerms.length) {
    const searchText = buildAssistantSearchText(combat, scores, judoka, competition);
    if (
      !textTerms.every((term) => searchText.includes(normalizeAssistantSearchText(term).trim()))
    ) {
      return false;
    }
  }
  return true;
}

function toAssistantMatch(
  judoka: JudokaRow | undefined,
  combat: CombatRow | undefined,
  competition: CompetitionRow | undefined,
  scores: CombatScoreRow[]
): CoachAssistantMatch {
  return {
    judokaId: String(judoka?.id_judoka || combat?.id_judoka || ""),
    judokaName: formatJudokaName(judoka),
    beltColor: String(judoka?.couleur_ceinture || ""),
    gender: String(judoka?.genre || ""),
    yearInCategory: judoka?.annee_categorie ? `${judoka.annee_categorie}e année` : "",
    competitionId: String(competition?.id_competition || combat?.id_competition || ""),
    competitionName: String(competition?.nom || ""),
    competitionDate: String(competition?.date || ""),
    opponent: String(combat?.adversaire || ""),
    result: String(combat?.resultat || ""),
    victoryType: String(combat?.type_victoire || ""),
    scoreLabel: scores.length
      ? scores.map(formatScoreLabel).join(", ")
      : String(judoka?.categorie_age || "")
  };
}

function scoreMatchesNeWazaType(score: CombatScoreRow, neWazaType: string): boolean {
  const normalizedType = normalizeNeWazaType(score.type_ne_waza);
  const normalizedTechnique = normalizeNeWazaType(score.technique);
  return normalizedType === neWazaType || normalizedTechnique === neWazaType;
}

function buildAssistantSearchText(
  combat: Pick<
    CombatRow,
    | "id_judoka"
    | "id_competition"
    | "adversaire"
    | "garde_adversaire"
    | "resultat"
    | "type_victoire"
    | "deroule"
  >,
  scores: CombatScoreRow[],
  judoka: JudokaRow | undefined,
  competition: CompetitionRow | undefined
): string {
  const scoreValues = scores.flatMap((score) => [
    score.categorie,
    score.technique,
    score.type_ne_waza,
    score.valeur
  ]);
  return normalizeAssistantSearchText(
    [
      combat.id_judoka,
      combat.id_competition,
      combat.adversaire,
      combat.garde_adversaire,
      combat.resultat,
      combat.type_victoire,
      combat.deroule,
      judoka?.id_judoka,
      judoka?.email,
      judoka?.prenom,
      judoka?.nom,
      judoka?.role,
      judoka?.profile_type,
      judoka?.categorie_age,
      judoka?.categorie_poids,
      judoka?.couleur_ceinture,
      judoka?.genre,
      judoka?.annee_categorie,
      judoka?.lateralite,
      competition?.id_competition,
      competition?.nom,
      competition?.date,
      competition?.categorie_age,
      competition?.categorie_poids,
      competition?.niveau,
      competition?.classement,
      competition?.coach_objective,
      competition?.coach_review,
      ...scoreValues
    ].join(" ")
  );
}

function formatJudokaName(judoka: { prenom?: string; nom?: string } | undefined): string {
  const name = [judoka?.prenom, judoka?.nom].filter(Boolean).join(" ").trim();
  return name || "Judoka non renseigné";
}

function formatScoreLabel(score: CombatScoreRow): string {
  const detail =
    String(score.categorie || "") === "Ne-waza"
      ? String(normalizeNeWazaType(score.type_ne_waza) || normalizeNeWazaType(score.technique) || "Au sol")
      : String(score.technique || "Debout");
  return [detail, score.valeur].filter(Boolean).join(" · ");
}
