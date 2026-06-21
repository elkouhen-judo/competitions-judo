import { AGE_CATEGORIES } from "../domain/competitions/competition";
import { GENDERS, HANDEDNESSES, COMPETITION_LEVELS } from "../domain/category-reference";
import { COMBAT_RESULTS } from "../domain/competitions/combat-result";
import { OPPONENT_STANCES } from "../domain/competitions/opponent-stance";
import { SCORE_VALUES } from "../domain/competitions/combat-score-value";
import { NE_WAZA_TYPES } from "../domain/competitions/ne-waza-type";
import type { McpScope } from "../types";

export type JsonSchema = Record<string, unknown>;
export type CoachMcpEntity = "judokas" | "combats" | "competitions";

/**
 * A coach-facing MCP read tool. `name` is the real MCP tool name (used by `tools/call`),
 * `groqName` is the same tool sanitized for Groq function-calling (no dots allowed).
 * Both the MCP server and the Groq tool-calling integration build their tool list from
 * this single source so the two never drift apart.
 */
export interface CoachMcpToolDefinition {
  name: string;
  groqName: string;
  entity: CoachMcpEntity;
  description: string;
  scope: McpScope;
  inputSchema: JsonSchema;
}

export const BELT_COLORS = [
  "Blanc", "Blanc-Jaune", "Jaune", "Jaune-Orange", "Orange", "Orange-Vert", "Vert",
  "Vert-Bleu", "Bleu", "Bleu-Marron", "Marron",
  "Noir 1er Dan", "Noir 2e Dan", "Noir 3e Dan", "Noir 4e Dan", "Noir 5e Dan"
];

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

const LIMIT_SCHEMA: JsonSchema = {
  type: "number",
  minimum: 1,
  maximum: MAX_LIMIT,
  default: DEFAULT_LIMIT,
  description: `Nombre maximum de résultats (${MAX_LIMIT} au plus, ${DEFAULT_LIMIT} par défaut si omis).`
};

const JUDOKA_FILTER_PROPERTIES: JsonSchema = {
  ageCategory: { type: "string", enum: AGE_CATEGORIES },
  beltColor: { type: "string", enum: BELT_COLORS },
  categoryYear: { type: "string", description: "Année dans la catégorie (ex. \"1\", \"2\", \"3\")." },
  gender: { type: "string", enum: GENDERS },
  handedness: { type: "string", enum: HANDEDNESSES },
  text: {
    type: "array",
    items: { type: "string" },
    description: "Mots-clés libres, notamment le prénom ou nom du judoka recherché."
  }
};

const COMPETITION_FILTER_PROPERTIES: JsonSchema = {
  competitionDate: { type: "string", description: "Date ISO AAAA-MM-JJ ou \"today\" pour aujourd'hui." },
  competitionLevel: { type: "string", enum: COMPETITION_LEVELS }
};

const COMBAT_FILTER_PROPERTIES: JsonSchema = {
  ...JUDOKA_FILTER_PROPERTIES,
  ...COMPETITION_FILTER_PROPERTIES,
  neWazaType: { type: "string", enum: NE_WAZA_TYPES },
  opponent: {
    type: "string",
    description: "Nom (ou partie du nom) de l'ADVERSAIRE uniquement. Pour le nom du judoka lui-même, utiliser text."
  },
  opponentStance: { type: "string", enum: OPPONENT_STANCES },
  result: { type: "string", enum: COMBAT_RESULTS },
  scoreValue: { type: "string", enum: SCORE_VALUES },
  tachiWazaTechnique: { type: "string", description: "Nom libre de prise debout à rechercher." },
  victoryType: { type: "string", description: "Type de décision (Ippon, Waza-ari, Hansoku-make...)." },
  text: {
    type: "array",
    items: { type: "string" },
    description:
      "Mots-clés libres à chercher dans le combat, y compris le prénom ou nom du judoka concerné (pas l'adversaire)."
  }
};

function buildFilteredListSchema(filterProperties: JsonSchema): JsonSchema {
  return {
    type: "object",
    properties: {
      filters: { type: "object", properties: filterProperties },
      limit: LIMIT_SCHEMA
    }
  };
}

export function buildCoachMcpToolDefinitions(): CoachMcpToolDefinition[] {
  return [
    {
      name: "judokas.search",
      groqName: "mcp_judokas_search",
      entity: "judokas",
      scope: "judokas:read",
      description:
        "Outil MCP judokas.search : cherche/liste les judokas visibles pour l'appelant (tout le roster du club pour un coach, " +
        "seulement soi-même et ses enfants pour un parent), avec filtres optionnels. " +
        `Chaque judoka inclut beltColor (une des valeurs ${BELT_COLORS.join(", ")}), ` +
        `gender (${GENDERS.join(" ou ")}), handedness (${HANDEDNESSES.join(" ou ")}) et ageCategory (${AGE_CATEGORIES.join(", ")}).`,
      inputSchema: buildFilteredListSchema(JUDOKA_FILTER_PROPERTIES)
    },
    {
      name: "competitions.search",
      groqName: "mcp_competitions_search",
      entity: "competitions",
      scope: "competitions:read",
      description:
        "Outil MCP competitions.search : cherche/liste les compétitions personnelles visibles pour le coach connecté, " +
        "sans le détail des combats, avec filtres optionnels sur la date et le niveau. " +
        "Utiliser competitions.get pour récupérer les combats d'une compétition donnée.",
      inputSchema: buildFilteredListSchema(COMPETITION_FILTER_PROPERTIES)
    },
    {
      name: "combats.search",
      groqName: "mcp_combats_search",
      entity: "combats",
      scope: "combats:read",
      description:
        "Outil MCP combats.search : cherche des combats visibles par résultat, décision, adversaire, " +
        "compétition, judoka ou score, avec filtres optionnels combinables.",
      inputSchema: buildFilteredListSchema(COMBAT_FILTER_PROPERTIES)
    }
  ];
}
