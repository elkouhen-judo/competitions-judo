import type { JudokaRow } from "../repositories/types";
import type { Competition, Judoka, McpScope, McpTokenClaims, RpcMethods } from "../types";
import { toCanonicalJudoka } from "./domain-adapters";
import { buildCoachMcpToolDefinitions, DEFAULT_LIMIT, MAX_LIMIT } from "./coach-mcp-tools";
import { AGE_CATEGORIES } from "../domain/competitions/competition";
import { GENDERS, HANDEDNESSES, COMPETITION_LEVELS } from "../domain/category-reference";
import { COMPETITION_RESULTS } from "../domain/competition-results";
import { COMBAT_RESULTS } from "../domain/competitions/combat-result";
import { OPPONENT_STANCES } from "../domain/competitions/opponent-stance";
import { SCORE_CATEGORIES } from "../domain/competitions/combat-score-category";
import { SCORE_VALUES } from "../domain/competitions/combat-score-value";
import { NE_WAZA_TYPES } from "../domain/competitions/ne-waza-type";

type McpToolHandler = (email: string, args: Record<string, unknown>) => Promise<unknown>;
type JsonSchema = Record<string, unknown>;

interface McpToolDefinition {
  name: string;
  description: string;
  scope: McpScope;
  inputSchema: JsonSchema;
  handler: McpToolHandler;
}

function applyListLimit<T>(items: T[], limit: unknown): T[] {
  const parsedLimit = Number(limit);
  const effectiveLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT;
  return items.slice(0, Math.min(effectiveLimit, MAX_LIMIT));
}

function normalizeSearchText(value: unknown): string {
  return String(value || "")
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ");
}

function asTextTerms(value: unknown): string[] {
  return (Array.isArray(value) ? value : value ? [value] : []).map((term) => String(term || "").trim()).filter(Boolean);
}

function matchesJudokaListFilters(judoka: Judoka, filters: Record<string, unknown>): boolean {
  if (filters.ageCategory && judoka.ageCategory !== filters.ageCategory) {
    return false;
  }
  if (filters.beltColor && judoka.beltColor !== filters.beltColor) {
    return false;
  }
  if (filters.categoryYear && judoka.yearInCategory !== filters.categoryYear) {
    return false;
  }
  if (filters.gender && judoka.gender !== filters.gender) {
    return false;
  }
  if (filters.handedness && judoka.handedness !== filters.handedness) {
    return false;
  }
  const textTerms = asTextTerms(filters.text);
  if (textTerms.length) {
    const searchText = normalizeSearchText([judoka.firstName, judoka.lastName].join(" "));
    if (!textTerms.every((term) => searchText.includes(normalizeSearchText(term).trim()))) {
      return false;
    }
  }
  return true;
}

function matchesCompetitionListFilters(competition: Competition, filters: Record<string, unknown>): boolean {
  if (filters.competitionDate && competition.competitionDate !== filters.competitionDate) {
    return false;
  }
  if (filters.competitionLevel && competition.level !== filters.competitionLevel) {
    return false;
  }
  return true;
}

const COMPETITION_SCHEMA: JsonSchema = {
  type: "object",
  description:
    "Compétition personnelle d'un judoka. Pour une mise à jour, fournir competitionId ; pour une création, l'omettre.",
  properties: {
    competitionId: {
      type: "string",
      description: "Identifiant de la compétition à mettre à jour. Omis lors d'une création."
    },
    name: { type: "string", description: "Nom de la compétition." },
    competitionDate: { type: "string", description: "Date de la compétition au format ISO 8601 (AAAA-MM-JJ)." },
    ageCategory: { type: "string", enum: AGE_CATEGORIES, description: "Catégorie d'âge du judoka pour cette compétition." },
    weightCategory: {
      type: "string",
      description:
        "Catégorie de poids (ex. \"-60kg\", \"+100kg\"), dépendante de ageCategory et du genre du judoka. Vide pour Poussinet/Poussin (pas de catégories officielles)."
    },
    level: { type: "string", enum: COMPETITION_LEVELS, description: "Niveau de la compétition." },
    ownerJudokaId: {
      type: "string",
      description: "Identifiant du judoka pour lequel la compétition est créée (par défaut le judoka du coach connecté si omis)."
    }
  },
  required: ["name", "competitionDate"]
};

const COMBAT_SCORE_SCHEMA: JsonSchema = {
  type: "object",
  description: "Une prise (score) marquée durant le combat.",
  properties: {
    category: { type: "string", enum: SCORE_CATEGORIES, description: "Type de prise : debout (Tachi-waza) ou au sol (Ne-waza)." },
    technique: {
      type: "string",
      description: "Nom libre de la prise, uniquement si category vaut \"Tachi-waza\"."
    },
    neWazaType: {
      type: "string",
      enum: NE_WAZA_TYPES,
      description: "Type de prise au sol, uniquement si category vaut \"Ne-waza\"."
    },
    value: { type: "string", enum: SCORE_VALUES, description: "Valeur de la prise." }
  },
  required: ["category", "value"]
};

const COMBAT_SCHEMA: JsonSchema = {
  type: "object",
  description:
    "Combat d'un judoka contre un adversaire. Pour une mise à jour, fournir combatId ; pour une création, l'omettre.",
  properties: {
    combatId: { type: "string", description: "Identifiant du combat à mettre à jour. Omis lors d'une création." },
    judokaId: { type: "string", description: "Identifiant du judoka qui a combattu." },
    competitionId: { type: "string", description: "Identifiant de la compétition à laquelle ce combat appartient." },
    opponent: { type: "string", description: "Nom de l'adversaire." },
    opponentStance: { type: "string", enum: OPPONENT_STANCES, description: "Garde de l'adversaire (optionnel)." },
    result: { type: "string", enum: COMBAT_RESULTS, description: "Issue du combat pour le judoka." },
    victoryType: {
      type: "string",
      enum: ["Ippon", "Waza-ari", "Yuko", "Décision", "Hansoku-make", "Forfait", "Hiki wake"],
      description:
        "Type de décision. Si result vaut \"Victoire\" ou \"Défaite\" : Ippon, Waza-ari, Yuko, Décision, Hansoku-make ou Forfait. Si result vaut \"Egalité\" : Hiki wake uniquement."
    },
    scores: {
      type: "array",
      items: COMBAT_SCORE_SCHEMA,
      description: "Liste des prises marquées durant le combat."
    },
    notes: { type: "string", description: "Notes libres du coach sur le combat (optionnel)." }
  },
  required: ["judokaId", "competitionId", "opponent", "result"]
};

const COACH_DASHBOARD_FILTERS_SCHEMA: JsonSchema = {
  type: "object",
  description: "Filtres optionnels appliqués aux statistiques du tableau de bord coach. Tous les champs sont optionnels et combinables.",
  properties: {
    competitionIds: {
      type: "array",
      items: { type: "string" },
      description: "Restreint les statistiques aux compétitions listées."
    },
    ageCategory: { type: "string", enum: AGE_CATEGORIES, description: "Filtre par catégorie d'âge." },
    categoryYear: { type: "string", description: "Filtre par année dans la catégorie (ex. \"1\", \"2\", \"3\")." },
    gender: { type: "string", enum: GENDERS, description: "Filtre par genre." },
    handedness: { type: "string", enum: HANDEDNESSES, description: "Filtre par garde du judoka." }
  }
};

export interface McpServerServiceDeps {
  methods: RpcMethods;
  getJudokas: (email: string) => Promise<JudokaRow[]>;
  getCurrentDate?: () => string;
}

export interface McpServerService {
  handleRequest(claims: McpTokenClaims, body: Record<string, unknown>): Promise<unknown>;
}

export default function createMcpServerService(deps: McpServerServiceDeps): McpServerService {
  const { methods, getJudokas, getCurrentDate = () => new Date().toISOString().slice(0, 10) } = deps;

  function resolveDateFilter(value: unknown): string {
    const trimmed = String(value || "").trim();
    return trimmed === "today" ? getCurrentDate() : trimmed;
  }

  const coachToolHandlers: Record<string, McpToolHandler> = {
    async "judokas.search"(email, args) {
      const judokas = (await getJudokas(email)).map(toCanonicalJudoka);
      const filters = (args.filters as Record<string, unknown>) || {};
      return applyListLimit(judokas.filter((judoka) => matchesJudokaListFilters(judoka, filters)), args.limit);
    },
    async "competitions.search"(email, args) {
      const initialData = await methods.getInitialData(email);
      const filters = { ...((args.filters as Record<string, unknown>) || {}) };
      if (filters.competitionDate) {
        filters.competitionDate = resolveDateFilter(filters.competitionDate);
      }
      return applyListLimit(
        initialData.competitions.filter((competition) => matchesCompetitionListFilters(competition, filters)),
        args.limit
      );
    },
    async "combats.search"(email, args) {
      return methods.searchCombats(
        email,
        (args.filters as Record<string, unknown>) || {},
        args.limit as number | undefined
      );
    }
  };

  const tools: McpToolDefinition[] = [
    ...buildCoachMcpToolDefinitions().map(({ name, description, scope, inputSchema }) => ({
      name,
      description,
      scope,
      inputSchema,
      handler: coachToolHandlers[name]
    })),
    {
      name: "competitions.get",
      description:
        "Détail d'une compétition (métadonnées, droits d'édition) avec la liste de ses combats. " +
        "Retourne une erreur si competitionId est inconnu ou non accessible au coach connecté.",
      scope: "competitions:read",
      inputSchema: {
        type: "object",
        properties: {
          competitionId: { type: "string", description: "Identifiant de la compétition à consulter." }
        },
        required: ["competitionId"]
      },
      async handler(email, args) {
        return methods.getCompetitionDetail(email, String(args.competitionId || ""));
      }
    },
    {
      name: "competitions.save",
      description:
        "Crée une compétition (sans competitionId dans l'objet) ou met à jour une compétition existante " +
        "(avec competitionId). Ne permet pas de définir le classement final : utiliser competitions.finalize pour cela.",
      scope: "competitions:write",
      inputSchema: {
        type: "object",
        properties: { competition: COMPETITION_SCHEMA },
        required: ["competition"]
      },
      async handler(email, args) {
        return methods.saveCompetition(email, (args.competition as Record<string, unknown>) || {});
      }
    },
    {
      name: "competitions.finalize",
      description:
        "Enregistre le classement final d'une compétition déjà créée. " +
        `result doit être l'une des valeurs : ${COMPETITION_RESULTS.join(", ")}.`,
      scope: "competitions:write",
      inputSchema: {
        type: "object",
        properties: {
          competitionId: { type: "string", description: "Identifiant de la compétition à finaliser." },
          result: {
            type: "string",
            enum: COMPETITION_RESULTS,
            description: "Classement final obtenu par le judoka dans cette compétition."
          }
        },
        required: ["competitionId", "result"]
      },
      async handler(email, args) {
        return methods.finalizeCompetition(
          email,
          String(args.competitionId || ""),
          String(args.result || "")
        );
      }
    },
    {
      name: "combats.save",
      description:
        "Ajoute un combat (sans combatId dans l'objet) ou met à jour un combat existant (avec combatId). " +
        "victoryType doit être cohérent avec result (Hiki wake uniquement pour Egalité, les autres types pour Victoire/Défaite).",
      scope: "combats:write",
      inputSchema: {
        type: "object",
        properties: { combat: COMBAT_SCHEMA },
        required: ["combat"]
      },
      async handler(email, args) {
        const combat = (args.combat as Record<string, unknown>) || {};
        return combat.combatId
          ? methods.updateCombat(email, combat)
          : methods.ajouterCombat(email, combat);
      }
    },
    {
      name: "combats.delete",
      description: "Supprime définitivement un combat. Action irréversible.",
      scope: "combats:write",
      inputSchema: {
        type: "object",
        properties: {
          combatId: { type: "string", description: "Identifiant du combat à supprimer." }
        },
        required: ["combatId"]
      },
      async handler(email, args) {
        return methods.deleteCombat(email, String(args.combatId || ""));
      }
    },
    {
      name: "coach.dashboard",
      description:
        "Statistiques agrégées des combats (taux de victoire, répartition par décision, par garde adverse, " +
        "par niveau de compétition, par genre, etc.) pour le tableau de bord coach, optionnellement filtrées.",
      scope: "combats:read",
      inputSchema: { type: "object", properties: { filters: COACH_DASHBOARD_FILTERS_SCHEMA } },
      async handler(email, args) {
        return methods.getCoachDashboard(email, (args.filters as never) || {});
      }
    }
  ];

  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));

  async function listTools() {
    return {
      tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
    };
  }

  async function callTool(claims: McpTokenClaims, params: Record<string, unknown>) {
    const name = String(params.name || "");
    const tool = toolsByName.get(name);
    if (!tool) {
      throw new Error("Outil MCP inconnu.");
    }
    if (!claims.scopes.includes(tool.scope)) {
      throw new Error("Portée MCP insuffisante.");
    }

    const args = (params.arguments as Record<string, unknown>) || {};
    const result = await tool.handler(claims.email, args);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }

  async function handleRequest(claims: McpTokenClaims, body: Record<string, unknown>) {
    const method = String(body.method || "");
    if (method === "tools/list") {
      return listTools();
    }
    if (method === "tools/call") {
      return callTool(claims, (body.params as Record<string, unknown>) || {});
    }
    throw new Error("Méthode MCP inconnue.");
  }

  return { handleRequest };
}
