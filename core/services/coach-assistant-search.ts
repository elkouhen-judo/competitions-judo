import {
  COACH_CHAT_MCP_ROUTER_PROMPT,
  COACH_CHAT_STRUCTURED_JSON_PROMPT
} from "../prompts/coach-chat-prompts";
import { buildCoachMcpToolDefinitions, DEFAULT_LIMIT, MAX_LIMIT } from "./coach-mcp-tools";
import type { CombatRow, CombatScoreRow, CompetitionRow, JudokaRow } from "../repositories/types";
import { formatCompetitionRankingDisplay } from "../domain/competition-results";
import type {
  CoachAssistantMatch,
  CoachAssistantResponse,
  CoachChatFilters,
  CoachChatHistoryMessage
} from "../types";

export interface AnthropicClient {
  generateChatCompletion(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  ): Promise<string>;
  generateToolChatCompletion?(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    tools: AnthropicToolDefinition[]
  ): Promise<AnthropicToolChatCompletion>;
}

export interface CoachChatDatasets {
  combatRows: CombatRow[];
  competitionRows: CompetitionRow[];
  judokaRows: JudokaRow[];
  scoresByCombatId: Map<string, CombatScoreRow[]>;
}

type CoachChatEntity = "judokas" | "combats" | "competitions";

interface AnthropicToolCall {
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface AnthropicToolChatCompletion {
  content: string;
  toolCalls: AnthropicToolCall[];
}

interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface CoachChatQuery {
  entity: CoachChatEntity;
  filters: CoachChatFilters;
  limit: number;
}

export interface CoachAssistantSearchDeps {
  getCurrentDate: () => string;
  anthropicClient?: AnthropicClient;
}

export interface CoachAssistantSearch {
  ask(
    question: string,
    datasets: CoachChatDatasets,
    history?: CoachChatHistoryMessage[]
  ): Promise<CoachAssistantResponse>;
  searchCombats(
    filters: CoachChatFilters,
    limit: number | undefined,
    datasets: CoachChatDatasets
  ): { matches: CoachAssistantMatch[] };
}

export function createCoachAssistantSearch(deps: CoachAssistantSearchDeps): CoachAssistantSearch {
  const { getCurrentDate, anthropicClient } = deps;

  async function ask(
    question: string,
    datasets: CoachChatDatasets,
    history: CoachChatHistoryMessage[] = []
  ): Promise<CoachAssistantResponse> {
    const query = normalizeAssistantText(question);
    if (!query) {
      return {
        answer:
          "Pose une question sur les combats enregistrés, par exemple : « Trouve les judokas qui ont gagné par Osaekomi ».",
        matches: [],
        beta: true
      };
    }

    const { judokaRows, competitionRows, combatRows, scoresByCombatId } = datasets;
    const judokasById = new Map(judokaRows.map((row) => [String(row.id_judoka), row]));
    const competitionsById = new Map(
      competitionRows.map((competition) => [String(competition.id_competition), competition])
    );

    const anthropicQuery = await parseCoachChatQueryWithAnthropic(question, history);
    if (anthropicQuery) {
      const anthropicResult = executeCoachChatQuery(anthropicQuery, datasets);
      if (anthropicResult.matches.length) {
        return anthropicResult;
      }
    }

    const desiredResult = resolveRequestedResult(query);
    const requestedNeWazaType = resolveRequestedNeWazaType(query);
    const queryTerms = extractAssistantSearchTerms(query).filter(
      (term) => !requestedNeWazaType || !isNeWazaAliasTerm(term)
    );
    const isGenericCombatListing = isCombatListQuestion(query);
    if (!desiredResult && !requestedNeWazaType && !queryTerms.length && !isGenericCombatListing) {
      return {
        answer:
          "Mode bêta : je peux chercher dans les attributs judoka, compétition, combat et scores enregistrés.",
        matches: [],
        beta: true
      };
    }

    const requestedAgeCategory = resolveRequestedAgeCategory(query);
    const requestedDate = resolveRequestedCompetitionDate(query);
    if (isJudokaListQuestion(query) && (requestedAgeCategory || requestedDate)) {
      const listMatches = buildJudokaListMatches(
        judokaRows,
        competitionRows,
        combatRows,
        requestedAgeCategory,
        requestedDate
      );
      return {
        answer: formatJudokaListAnswer(listMatches, requestedAgeCategory, requestedDate),
        matches: listMatches,
        beta: true
      };
    }

    const matches = combatRows
      .filter((combat) => !desiredResult || String(combat.resultat || "") === desiredResult)
      .flatMap((combat): CoachAssistantMatch[] => {
        const scores = scoresByCombatId.get(String(combat.id_combat)) || [];
        const matchingScores = requestedNeWazaType
          ? scores.filter((score) => String(score.type_ne_waza || "") === requestedNeWazaType)
          : scores;
        if (requestedNeWazaType && !matchingScores.length) {
          return [];
        }
        const judoka = judokasById.get(String(combat.id_judoka));
        const competition = competitionsById.get(String(combat.id_competition));
        const searchText = buildAssistantSearchText(combat, matchingScores, judoka, competition);
        if (queryTerms.length && !queryTerms.every((term) => searchText.includes(term))) {
          return [];
        }
        const scoreLabel = matchingScores.length
          ? matchingScores.map(formatScoreLabel).join(", ")
          : "Aucune technique détaillée";
        return [
          {
            judokaId: String(combat.id_judoka || ""),
            judokaName: formatJudokaName(judoka),
            beltColor: String(judoka?.couleur_ceinture || ""),
            competitionId: String(combat.id_competition || ""),
            competitionName: String(competition?.nom || "Compétition"),
            competitionDate: String(competition?.date || ""),
            opponent: String(combat.adversaire || "Adversaire non renseigné"),
            result: String(combat.resultat || ""),
            victoryType: String(combat.type_victoire || ""),
            scoreLabel
          }
        ];
      })
      .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate))
      .slice(0, 12);

    return {
      answer: formatAssistantAnswer(matches, desiredResult, requestedNeWazaType, queryTerms),
      matches,
      beta: true
    };
  }

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

  async function parseCoachChatQueryWithAnthropic(
    question: string,
    history: CoachChatHistoryMessage[]
  ): Promise<CoachChatQuery | null> {
    if (!anthropicClient) {
      return null;
    }
    try {
      const toolQuery = await parseCoachChatQueryWithAnthropicTools(question, history);
      if (toolQuery) {
        return resolveRelativeDates(toolQuery);
      }

      const content = await anthropicClient.generateChatCompletion([
        {
          role: "system",
          content: COACH_CHAT_STRUCTURED_JSON_PROMPT
        },
        ...buildHistoryMessages(history),
        {
          role: "user",
          content: question
        }
      ]);
      return resolveRelativeDates(normalizeCoachChatQuery(content));
    } catch (error) {
      console.error("Échec de l'interprétation Anthropic du chat coach :", error);
      throw new Error(formatAnthropicUnavailableMessage(error));
    }
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

  async function parseCoachChatQueryWithAnthropicTools(
    question: string,
    history: CoachChatHistoryMessage[]
  ): Promise<CoachChatQuery | null> {
    if (!anthropicClient.generateToolChatCompletion) {
      return null;
    }
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: COACH_CHAT_MCP_ROUTER_PROMPT
      },
      ...buildHistoryMessages(history),
      { role: "user", content: question }
    ];
    const completion = await anthropicClient.generateToolChatCompletion(
      messages,
      buildCoachMcpAnthropicTools()
    );
    const toolCall = (completion.toolCalls || [])[0];
    if (toolCall) {
      return normalizeCoachMcpToolCallQuery(toolCall);
    }
    return normalizeCoachChatQuery(completion.content);
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

  function resolveRequestedCompetitionDate(query: string): string {
    const searchableQuery = normalizeAssistantSearchText(query);
    if (/\baujourd hui\b|\bce jour\b/.test(searchableQuery)) {
      return getCurrentDate();
    }
    const dateMatch = searchableQuery.match(/\b(20\d{2} \d{2} \d{2})\b/);
    if (dateMatch) {
      return dateMatch[1].replace(/\s/g, "-");
    }
    const isoDateMatch = query.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    return isoDateMatch ? isoDateMatch[1] : "";
  }

  return { ask, searchCombats };
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

function formatAnthropicUnavailableMessage(error: unknown): string {
  const status = (error as { anthropicStatus?: number } | null)?.anthropicStatus;
  if (status === 429) {
    return "L'assistant IA est temporairement surchargé (limite de débit Anthropic atteinte). Réessayez dans quelques secondes.";
  }
  return "L'assistant IA est momentanément indisponible. Réessayez dans quelques instants.";
}

function buildHistoryMessages(
  history: CoachChatHistoryMessage[]
): Array<{ role: "user" | "assistant"; content: string }> {
  return history
    .filter((message) => message.text.trim())
    .map((message) => ({ role: message.role, content: message.text }));
}

function buildCoachMcpAnthropicTools(): AnthropicToolDefinition[] {
  return buildCoachMcpToolDefinitions().map((definition) => ({
    name: definition.anthropicName,
    description: definition.description,
    input_schema: definition.inputSchema
  }));
}

function normalizeCoachMcpToolCallQuery(toolCall: AnthropicToolCall): CoachChatQuery | null {
  const name = String(toolCall.function?.name || "");
  const definition = buildCoachMcpToolDefinitions().find((tool) => tool.anthropicName === name);
  if (!definition) {
    return null;
  }
  const args = parseToolCallArguments(toolCall.function?.arguments);
  return buildCoachChatQueryWithoutDateResolution({
    entity: definition.entity,
    filters:
      args.filters && typeof args.filters === "object"
        ? (args.filters as Record<string, unknown>)
        : {},
    limit: args.limit
  });
}

function parseToolCallArguments(rawArguments: unknown): Record<string, unknown> {
  if (!rawArguments) {
    return {};
  }
  if (typeof rawArguments === "object") {
    return rawArguments as Record<string, unknown>;
  }
  try {
    return JSON.parse(String(rawArguments));
  } catch {
    return {};
  }
}

function normalizeCoachChatQuery(rawContent: string): CoachChatQuery | null {
  const raw = String(rawContent || "").trim();
  if (!raw) {
    return null;
  }
  const jsonText = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return buildCoachChatQueryWithoutDateResolution(JSON.parse(jsonText));
  } catch {
    return null;
  }
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
    neWazaType: String(filters.neWazaType || "").trim() || undefined,
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
): CoachAssistantResponse {
  const { judokaRows, competitionRows, combatRows, scoresByCombatId } = datasets;
  const competitionsById = new Map(
    competitionRows.map((competition) => [String(competition.id_competition), competition])
  );
  const judokasById = new Map(judokaRows.map((judoka) => [String(judoka.id_judoka), judoka]));
  if (query.entity === "judokas") {
    const matches = searchCoachJudokas(
      query,
      judokaRows,
      combatRows,
      competitionsById,
      scoresByCombatId
    );
    return {
      answer: formatEntityAnswer("judoka", matches.length, query.limit),
      matches,
      beta: true
    };
  }
  if (query.entity === "competitions") {
    const matches = searchCoachCompetitions(
      query,
      competitionRows,
      combatRows,
      judokasById,
      scoresByCombatId
    );
    return {
      answer: formatEntityAnswer("compétition", matches.length, query.limit),
      matches,
      beta: true
    };
  }
  const matches = searchCoachCombats(
    query,
    combatRows,
    judokasById,
    competitionsById,
    scoresByCombatId
  );
  return {
    answer: formatEntityAnswer("combat", matches.length, query.limit),
    matches,
    beta: true
  };
}

function searchCoachJudokas(
  query: CoachChatQuery,
  judokaRows: JudokaRow[],
  combatRows: CombatRow[],
  competitionsById: Map<string, CompetitionRow>,
  scoresByCombatId: Map<string, CombatScoreRow[]>
): CoachAssistantMatch[] {
  const combatFilters = hasCombatFilters(query);
  return judokaRows
    .filter((judoka) => matchesJudokaFilters(judoka, query))
    .flatMap((judoka): CoachAssistantMatch[] => {
      const relatedCombat = combatFilters
        ? combatRows.find((combat) => {
            if (String(combat.id_judoka || "") !== String(judoka.id_judoka || "")) {
              return false;
            }
            return matchesCombatFilters(
              combat,
              scoresByCombatId.get(String(combat.id_combat)) || [],
              judoka,
              competitionsById.get(String(combat.id_competition)),
              query
            );
          })
        : undefined;
      if (combatFilters && !relatedCombat) {
        return [];
      }
      const competition = relatedCombat
        ? competitionsById.get(String(relatedCombat.id_competition))
        : undefined;
      return [
        toAssistantMatch(
          judoka,
          relatedCombat,
          competition,
          relatedCombat ? scoresByCombatId.get(String(relatedCombat.id_combat)) || [] : []
        )
      ];
    })
    .sort((a, b) => a.judokaName.localeCompare(b.judokaName))
    .slice(0, query.limit);
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

function searchCoachCompetitions(
  query: CoachChatQuery,
  competitionRows: CompetitionRow[],
  combatRows: CombatRow[],
  judokasById: Map<string, JudokaRow>,
  scoresByCombatId: Map<string, CombatScoreRow[]>
): CoachAssistantMatch[] {
  return competitionRows
    .filter((competition) => matchesCompetitionFilters(competition, query))
    .filter((competition) => {
      if (!hasCombatFilters(query) && !hasJudokaFilters(query)) {
        return true;
      }
      return combatRows.some((combat) => {
        if (String(combat.id_competition || "") !== String(competition.id_competition || "")) {
          return false;
        }
        return matchesCombatFilters(
          combat,
          scoresByCombatId.get(String(combat.id_combat)) || [],
          judokasById.get(String(combat.id_judoka)),
          competition,
          query
        );
      });
    })
    .map((competition) => ({
      judokaId: "",
      judokaName: String(competition.nom || "Compétition"),
      beltColor: "",
      competitionId: String(competition.id_competition || ""),
      competitionName: String(competition.nom || ""),
      competitionDate: String(competition.date || ""),
      opponent: "",
      result: "",
      victoryType: "",
      scoreLabel: [
        competition.categorie_age,
        competition.niveau,
        formatCompetitionRankingDisplay(competition.classement)
      ]
        .filter(Boolean)
        .join(" · ")
    }))
    .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate))
    .slice(0, query.limit);
}

function hasJudokaFilters(query: CoachChatQuery): boolean {
  return Boolean(
    query.filters.ageCategory ||
    query.filters.beltColor ||
    query.filters.categoryYear ||
    query.filters.gender ||
    query.filters.handedness ||
    query.filters.text?.length
  );
}

function hasCombatFilters(query: CoachChatQuery): boolean {
  return Boolean(
    query.filters.competitionDate ||
    query.filters.competitionLevel ||
    query.filters.neWazaType ||
    query.filters.opponent ||
    query.filters.opponentStance ||
    query.filters.result ||
    query.filters.scoreValue ||
    query.filters.tachiWazaTechnique ||
    query.filters.victoryType
  );
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
    !scores.some((score) => String(score.type_ne_waza || "") === query.filters.neWazaType)
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

function formatEntityAnswer(entityLabel: string, count: number, limit: number): string {
  if (!count) {
    return `Aucun ${entityLabel} trouvé.`;
  }
  const suffix = count >= limit ? ` Les ${limit} premiers résultats sont affichés.` : "";
  return `${count} ${entityLabel}(s) trouvé(s).${suffix}`;
}

function extractAssistantSearchTerms(query: string): string[] {
  const stopWords = new Set([
    "a",
    "au",
    "aux",
    "avec",
    "affiche",
    "afficher",
    "cherche",
    "chercher",
    "combat",
    "combats",
    "dans",
    "de",
    "des",
    "du",
    "en",
    "fait",
    "gagne",
    "gagnes",
    "gagnent",
    "judoka",
    "judokas",
    "la",
    "le",
    "les",
    "liste",
    "lister",
    "moi",
    "montre",
    "montrer",
    "ont",
    "par",
    "pour",
    "qui",
    "trouve",
    "trouver",
    "un",
    "une"
  ]);
  return normalizeAssistantSearchText(query)
    .split(/\s+/)
    .filter((term) => term.length > 1 && !stopWords.has(term));
}

function resolveRequestedResult(query: string): string {
  if (/\b(gagne|gagnes|gagnent|victoire|victoires|win|won)\b/.test(query)) {
    return "Victoire";
  }
  if (/\b(perdu|perdus|perdent|defaite|defaites|loss|lost)\b/.test(query)) {
    return "Défaite";
  }
  if (/\b(egalite|nul|nuls|draw)\b/.test(query)) {
    return "Egalité";
  }
  return "";
}

function resolveRequestedNeWazaType(query: string): string {
  if (/o+a?sae?komi|immobilisation/.test(query)) {
    return "Osaekomi";
  }
  if (/etranglement/.test(query)) {
    return "Étranglement";
  }
  if (/\bcle\b|cle de bras/.test(query)) {
    return "Clé";
  }
  return "";
}

function isJudokaListQuestion(query: string): boolean {
  return (
    /\b(liste|lister|affiche|afficher|montre|montrer|qui)\b/.test(query) &&
    /\bjudoka|judokas\b/.test(query)
  );
}

function isCombatListQuestion(query: string): boolean {
  return (
    /\b(liste|lister|affiche|afficher|montre|montrer|cherche|chercher|trouve|trouver)\b/.test(
      query
    ) && /\bcombat|combats\b/.test(query)
  );
}

function resolveRequestedAgeCategory(query: string): string {
  const categories = [
    ["poussinets?", "Poussinet"],
    ["poussins?", "Poussin"],
    ["benjamins?", "Benjamin"],
    ["minimes?", "Minime"],
    ["cadets?", "Cadet"],
    ["juniors?", "Junior"],
    ["seniors?", "Senior"],
    ["veterans?", "Vétéran"]
  ];
  const match = categories.find(([pattern]) => new RegExp(`\\b${pattern}\\b`).test(query));
  return match ? match[1] : "";
}

function buildJudokaListMatches(
  judokaRows: Array<{
    id_judoka?: string;
    prenom?: string;
    nom?: string;
    categorie_age?: string;
    couleur_ceinture?: string;
  }>,
  competitionRows: Array<{
    id_competition?: string;
    nom?: string;
    date?: string;
  }>,
  combatRows: Array<{
    id_judoka?: string;
    id_competition?: string;
  }>,
  requestedAgeCategory: string,
  requestedDate: string
): CoachAssistantMatch[] {
  const competitionsById = new Map(
    competitionRows.map((competition) => [String(competition.id_competition), competition])
  );
  const combatByJudokaId = new Map<
    string,
    { competitionId: string; competitionName: string; competitionDate: string }
  >();
  combatRows.forEach((combat) => {
    const competition = competitionsById.get(String(combat.id_competition));
    if (requestedDate && String(competition?.date || "") !== requestedDate) {
      return;
    }
    const judokaId = String(combat.id_judoka || "");
    if (!judokaId || combatByJudokaId.has(judokaId)) {
      return;
    }
    combatByJudokaId.set(judokaId, {
      competitionId: String(combat.id_competition || ""),
      competitionName: String(competition?.nom || "Compétition"),
      competitionDate: String(competition?.date || "")
    });
  });
  return judokaRows
    .filter(
      (judoka) =>
        !requestedAgeCategory || String(judoka.categorie_age || "") === requestedAgeCategory
    )
    .filter((judoka) => !requestedDate || combatByJudokaId.has(String(judoka.id_judoka || "")))
    .map((judoka) => {
      const combatInfo = combatByJudokaId.get(String(judoka.id_judoka || ""));
      return {
        judokaId: String(judoka.id_judoka || ""),
        judokaName: formatJudokaName(judoka),
        beltColor: String(judoka.couleur_ceinture || ""),
        competitionId: combatInfo?.competitionId || "",
        competitionName: combatInfo?.competitionName || "",
        competitionDate: combatInfo?.competitionDate || "",
        opponent: "",
        result: "",
        victoryType: "",
        scoreLabel: String(judoka.categorie_age || "")
      };
    })
    .sort((a, b) => a.judokaName.localeCompare(b.judokaName))
    .slice(0, 20);
}

function formatJudokaListAnswer(
  matches: CoachAssistantMatch[],
  requestedAgeCategory: string,
  requestedDate: string
): string {
  const criteria = [
    requestedAgeCategory ? `catégorie ${requestedAgeCategory}` : "",
    requestedDate ? `combat le ${requestedDate}` : ""
  ]
    .filter(Boolean)
    .join(" + ");
  if (!matches.length) {
    return `Aucun judoka trouvé pour ${criteria}.`;
  }
  const suffix = matches.length >= 20 ? " Les 20 premiers résultats sont affichés." : "";
  return `${matches.length} judoka(s) trouvé(s) pour ${criteria}.${suffix}`;
}

function isNeWazaAliasTerm(term: string): boolean {
  return /o+a?sae?komi|immobilisation|etranglement|\bcle\b/.test(term);
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
      ? String(score.type_ne_waza || "Au sol")
      : String(score.technique || "Debout");
  return [detail, score.valeur].filter(Boolean).join(" · ");
}

function formatAssistantAnswer(
  matches: CoachAssistantMatch[],
  desiredResult: string,
  requestedNeWazaType: string,
  queryTerms: string[]
): string {
  const distinctJudokas = new Set(matches.map((match) => match.judokaId)).size;
  const criteria = [desiredResult, requestedNeWazaType, ...queryTerms].filter(Boolean).join(" + ");
  const criteriaSuffix = criteria ? ` correspondant à ${criteria}` : "";
  if (!matches.length) {
    return criteria ? `Aucun combat trouvé pour ${criteria}.` : "Aucun combat enregistré.";
  }
  const suffix = matches.length >= 12 ? " Les 12 résultats les plus récents sont affichés." : "";
  return `${distinctJudokas} judoka(s) trouvé(s), ${matches.length} combat(s)${criteriaSuffix}.${suffix}`;
}
