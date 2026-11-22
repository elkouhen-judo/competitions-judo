import type { JudokaRow } from "../repositories/types";
import type { Club, Competition, Judoka, McpScope, McpTokenClaims, RpcMethods } from "../types";
import { toCanonicalJudoka } from "./domain-adapters";
import { buildCoachMcpToolDefinitions, DEFAULT_LIMIT, MAX_LIMIT } from "./coach-mcp-tools";
import { AGE_CATEGORIES } from "../domain/competitions/competition";
import { COMPETITION_LEVELS } from "../domain/category-reference";
import { COMPETITION_RESULTS } from "../domain/competition-results";
import { COMBAT_RESULTS } from "../domain/competitions/combat-result";
import { OPPONENT_STANCES } from "../domain/competitions/opponent-stance";
import { COMBAT_STAGES } from "../domain/competitions/combat-stage";
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
  description: "Un point marqué durant le combat.",
  properties: {
    category: { type: "string", enum: SCORE_CATEGORIES, description: "Situation du point : Debout ou Au sol." },
    technique: {
      type: "string",
      description: "Nom libre de l'action, uniquement pour un point debout."
    },
    neWazaType: {
      type: "string",
      description: `Nom de l'action au sol, libre ou parmi les suggestions : ${NE_WAZA_TYPES.join(", ")}.`
    },
    value: { type: "string", enum: SCORE_VALUES, description: "Point marqué." }
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
    opponentStance: { type: "string", enum: OPPONENT_STANCES, description: "Adversaire droitier ou gaucher (optionnel)." },
    stage: { type: "string", enum: COMBAT_STAGES, description: "Étape du combat dans la compétition : poule, tour du tableau, repêchage, place de 3 ou finale (optionnel)." },
    result: { type: "string", enum: COMBAT_RESULTS, description: "Résultat du combat pour le judoka." },
    victoryType: {
      type: "string",
      enum: ["Ippon", "Waza-ari", "Yuko", "Décision", "Hansoku-make", "Forfait", "Hiki wake"],
      description:
        "Type de décision. Si result vaut \"Victoire\" ou \"Défaite\" : Ippon, Waza-ari, Yuko, Décision, Hansoku-make ou Forfait. Si result vaut \"Egalité\" : Hiki wake uniquement."
    },
    scores: {
      type: "array",
      items: COMBAT_SCORE_SCHEMA,
      description: "Liste des techniques marquées durant le combat."
    },
    notes: { type: "string", description: "Notes libres du coach sur le combat (optionnel)." }
  },
  required: ["judokaId", "competitionId", "opponent", "result"]
};

const COACH_DASHBOARD_FILTERS_SCHEMA: JsonSchema = {
  type: "object",
  description: "Filtres optionnels appliqués aux statistiques du tableau de bord coach. Tous les champs sont optionnels et combinables.",
  properties: {
    // MULTI-7 : les mêmes filtres que l'écran (DASH-002), et aucun autre.
    clubId: { type: "string", description: "Identifiant d'un club du coach (clubs.list) ; omis : tous ses clubs." },
    dateFrom: { type: "string", description: "Date de début ISO AAAA-MM-JJ." },
    dateTo: { type: "string", description: "Date de fin ISO AAAA-MM-JJ." },
    ageCategory: { type: "string", enum: AGE_CATEGORIES, description: "Filtre par catégorie d'âge." },
    competitionIds: {
      type: "array",
      items: { type: "string" },
      description: "Restreint les statistiques aux compétitions listées."
    }
  }
};

export interface McpServerServiceDeps {
  methods: RpcMethods;
  getJudokas: (email: string) => Promise<JudokaRow[]>;
  /** MULTI-7 : les clubs coachés par l'appelant (vide pour un parent ou un judoka). */
  getClubs: (email: string) => Promise<Club[]>;
  getCurrentDate?: () => string;
}

export interface McpServerService {
  handleRequest(claims: McpTokenClaims, body: Record<string, unknown>): Promise<unknown>;
}

export default function createMcpServerService(deps: McpServerServiceDeps): McpServerService {
  const { methods, getJudokas, getClubs, getCurrentDate = () => new Date().toISOString().slice(0, 10) } = deps;

  function resolveDateFilter(value: unknown): string {
    const trimmed = String(value || "").trim();
    return trimmed === "today" ? getCurrentDate() : trimmed;
  }

  // MULTI-7 : un club demandé doit être un club du coach, comme à l'écran (CLUB-005).
  function assertKnownClub(clubs: Club[], clubId: unknown) {
    if (clubId && !clubs.some((club) => club.clubId === String(clubId))) {
      throw new Error("Club introuvable.");
    }
  }

  function clubNameOf(clubs: Club[], clubId: string) {
    const club = clubs.find((candidate) => candidate.clubId === clubId);
    return club ? club.name : "";
  }

  const coachToolHandlers: Record<string, McpToolHandler> = {
    async "judokas.search"(email, args) {
      const [rows, clubs] = await Promise.all([getJudokas(email), getClubs(email)]);
      const filters = (args.filters as Record<string, unknown>) || {};
      assertKnownClub(clubs, filters.clubId);
      const judokas = rows
        .map(toCanonicalJudoka)
        .filter((judoka) => !filters.clubId || judoka.clubId === String(filters.clubId))
        .map((judoka) => ({ ...judoka, clubName: clubNameOf(clubs, String(judoka.clubId || "")) }));
      return applyListLimit(judokas.filter((judoka) => matchesJudokaListFilters(judoka, filters)), args.limit);
    },
    async "competitions.search"(email, args) {
      const initialData = await methods.getInitialData(email);
      const clubs = initialData.clubs || [];
      const filters = { ...((args.filters as Record<string, unknown>) || {}) };
      assertKnownClub(clubs, filters.clubId);
      if (filters.competitionDate) {
        filters.competitionDate = resolveDateFilter(filters.competitionDate);
      }
      // Le club d'une compétition est celui de sa compétition club (MULTI-4), sinon celui du judoka.
      const eventClubById = new Map(
        (initialData.clubCompetitions || []).map((event) => [String(event.clubCompetitionId), String(event.clubId || "")])
      );
      const judokaClubById = new Map(
        (initialData.judokas || []).map((judoka) => [String(judoka.judokaId), String(judoka.clubId || "")])
      );
      const competitions = initialData.competitions
        .map((competition) => {
          const clubId =
            eventClubById.get(String(competition.clubCompetitionId || "")) ||
            judokaClubById.get(String(competition.ownerJudokaId || "")) ||
            "";
          return { ...competition, clubId, clubName: clubNameOf(clubs, clubId) };
        })
        .filter((competition) => !filters.clubId || competition.clubId === String(filters.clubId));
      return applyListLimit(
        competitions.filter((competition) => matchesCompetitionListFilters(competition, filters)),
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
    {
      name: "clubs.list",
      description:
        "Liste les clubs coachés par l'appelant (clubId et name). Le clubId sert de filtre à judokas.search, " +
        "competitions.search et coach.dashboard.",
      scope: "coach-dashboard:read",
      inputSchema: { type: "object", properties: {} },
      async handler(email) {
        return getClubs(email);
      }
    },
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
        "Met à jour une compétition existante (competitionId obligatoire). Ne crée pas de compétition : " +
        "seul le coach en crée, depuis une compétition club. Ne permet pas de définir le classement final : " +
        "utiliser competitions.finalize pour cela.",
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
        "Statistiques agrégées des combats (taux de victoire, podiums par niveau, évolution, fins de combat, " +
        "techniques, debout ou au sol) pour le tableau de bord coach, " +
        "optionnellement filtrées. Aucune donnée propre à un judoka ; sous 2 judokas, stats vaut null.",
      scope: "coach-dashboard:read",
      inputSchema: { type: "object", properties: { filters: COACH_DASHBOARD_FILTERS_SCHEMA } },
      async handler(email, args) {
        return methods.getCoachDashboard(email, (args.filters as never) || {});
      }
    }
  ];

  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));

  async function listTools(claims: McpTokenClaims) {
    const allowedTools = tools.filter((tool) => claims.scopes.includes(tool.scope));
    return {
      tools: allowedTools.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema
      }))
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
      return listTools(claims);
    }
    if (method === "tools/call") {
      return callTool(claims, (body.params as Record<string, unknown>) || {});
    }
    throw new Error("Méthode MCP inconnue.");
  }

  return { handleRequest };
}
