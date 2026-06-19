import { toCanonicalCombat, toCanonicalJudoka } from "./domain-adapters";
import { computeCoachDashboardStats } from "../domain/coach-dashboard-statistics";
import type { CombatsRepository } from "../repositories/combats.repository";
import type { CombatScoreRow } from "../repositories/types";
import type { CombatScoresRepository } from "../repositories/combat-scores.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { JudokasRepository } from "../repositories/judokas.repository";
import type {
  CoachAssistantMatch,
  CoachAssistantResponse,
  CoachDashboard,
  CoachDashboardFilters,
  RpcMethods
} from "../types";
import type { UserContextService } from "./user-context.service";

type CoachDashboardMethods = Pick<RpcMethods, "askCoachAssistant" | "getCoachDashboard">;

interface GroqClient {
  generateChatCompletion(messages: Array<{ role: "system" | "user"; content: string }>): Promise<string>;
}

type CoachChatEntity = "judokas" | "combats" | "competitions";

interface CoachChatQuery {
  entity: CoachChatEntity;
  filters: {
    ageCategory?: string;
    beltColor?: string;
    categoryYear?: string;
    competitionDate?: string;
    competitionLevel?: string;
    gender?: string;
    handedness?: string;
    neWazaType?: string;
    opponent?: string;
    opponentStance?: string;
    result?: string;
    scoreValue?: string;
    tachiWazaTechnique?: string;
    victoryType?: string;
    text?: string[];
  };
  limit: number;
}

export interface CoachDashboardServiceDeps {
  combatsRepository: CombatsRepository;
  combatScoresRepository: CombatScoresRepository;
  competitionsRepository: CompetitionsRepository;
  getCurrentDate?: () => string;
  groqClient?: GroqClient;
  judokasRepository: JudokasRepository;
  userContextService: UserContextService;
}

export interface CoachDashboardService {
  methods: CoachDashboardMethods;
}

export default function createCoachDashboardService(
  deps: CoachDashboardServiceDeps
): CoachDashboardService {
  const {
    combatsRepository,
    combatScoresRepository,
    competitionsRepository,
    getCurrentDate = () => new Date().toISOString().slice(0, 10),
    groqClient,
    judokasRepository,
    userContextService
  } = deps;

  async function getCoachDashboard(
    email: string,
    filters: CoachDashboardFilters = {}
  ): Promise<CoachDashboard> {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    if (domainUser.accessRole !== "COACH") {
      throw new Error("Tableau de bord réservé aux coachs.");
    }

    const ageCategory = String(filters.ageCategory || "").trim();
    const categoryYear = String(filters.categoryYear || "").trim();
    const dateFrom = String(filters.dateFrom || "").trim();
    const dateTo = String(filters.dateTo || "").trim();
    const gender = String(filters.gender || "").trim();
    const handedness = String(filters.handedness || "").trim();
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new Error("La date de début doit être antérieure ou égale à la date de fin.");
    }
    const selectedCompetitionIds =
      Array.isArray(filters.competitionIds) && filters.competitionIds.length
        ? new Set(filters.competitionIds.map(String))
        : null;

    const allCompetitionRows = await competitionsRepository.listAll();
    const competitionRows = allCompetitionRows.filter((competition) => {
      if (selectedCompetitionIds && !selectedCompetitionIds.has(String(competition.id_competition))) {
        return false;
      }
      const competitionDate = String(competition.date || "");
      if (dateFrom && competitionDate < dateFrom) {
        return false;
      }
      if (dateTo && competitionDate > dateTo) {
        return false;
      }
      if (ageCategory && String(competition.categorie_age || "") !== ageCategory) {
        return false;
      }
      return true;
    });

    const judokaRows = await judokasRepository.listAll();
    const judokasById = new Map(judokaRows.map((row) => [String(row.id_judoka), toCanonicalJudoka(row)]));
    const competitionLevelById = new Map(
      competitionRows.map((competition) => [
        String(competition.id_competition),
        String(competition.niveau || "")
      ])
    );

    const combatRowsByCompetition = await Promise.all(
      competitionRows.map((competition) => combatsRepository.listByCompetition(competition.id_competition))
    );
    const combatRows = combatRowsByCompetition.flat();

    const scoreRows = await combatScoresRepository.listByCombatIds(
      combatRows.map((combat) => combat.id_combat)
    );
    const scoresByCombatId = new Map<string, CombatScoreRow[]>();
    scoreRows.forEach((score) => {
      const idCombat = String(score.id_combat);
      scoresByCombatId.set(idCombat, [...(scoresByCombatId.get(idCombat) || []), score]);
    });

    const filteredCombatRows = combatRows.filter((combat) => {
      if (!gender && !categoryYear && !handedness) {
        return true;
      }
      const judoka = judokasById.get(String(combat.id_judoka));
      if (gender && (!judoka || judoka.gender !== gender)) {
        return false;
      }
      if (categoryYear && (!judoka || judoka.yearInCategory !== categoryYear)) {
        return false;
      }
      if (handedness && (!judoka || judoka.handedness !== handedness)) {
        return false;
      }
      return true;
    });

    const combats = filteredCombatRows.map((combat) => ({
      ...toCanonicalCombat({
        ...combat,
        scores: scoresByCombatId.get(String(combat.id_combat)) || []
      }),
      competitionLevel: competitionLevelById.get(String(combat.id_competition)) || "",
      judokaGender: judokasById.get(String(combat.id_judoka))?.gender || "",
      judokaHandedness: judokasById.get(String(combat.id_judoka))?.handedness || ""
    }));

    return { stats: computeCoachDashboardStats(combats) };
  }

  async function askCoachAssistant(
    email: string,
    question: string
  ): Promise<CoachAssistantResponse> {
    const { domainUser } = await userContextService.getDomainUserContext(email);
    if (domainUser.accessRole !== "COACH") {
      throw new Error("Assistant coach réservé aux coachs.");
    }

    const query = normalizeAssistantText(question);
    if (!query) {
      return {
        answer: "Pose une question sur les combats enregistrés, par exemple : « Trouve les judokas qui ont gagné par Osaekomi ».",
        matches: [],
        beta: true
      };
    }

    const desiredResult = resolveRequestedResult(query);
    const requestedNeWazaType = resolveRequestedNeWazaType(query);
    const queryTerms = extractAssistantSearchTerms(query).filter(
      (term) => !requestedNeWazaType || !isNeWazaAliasTerm(term)
    );
    if (!desiredResult && !requestedNeWazaType && !queryTerms.length) {
      return {
        answer: "Mode bêta : je peux chercher dans les attributs judoka, compétition, combat et scores enregistrés.",
        matches: [],
        beta: true
      };
    }

    const [competitionRows, judokaRows] = await Promise.all([
      competitionsRepository.listAll(),
      judokasRepository.listAll()
    ]);
    const judokasById = new Map(judokaRows.map((row) => [String(row.id_judoka), row]));
    const competitionsById = new Map(
      competitionRows.map((competition) => [String(competition.id_competition), competition])
    );
    const combatRowsByCompetition = await Promise.all(
      competitionRows.map((competition) => combatsRepository.listByCompetition(competition.id_competition))
    );
    const combatRows = combatRowsByCompetition.flat();
    const scoreRows = await combatScoresRepository.listByCombatIds(
      combatRows.map((combat) => combat.id_combat)
    );
    const scoresByCombatId = new Map<string, CombatScoreRow[]>();
    scoreRows.forEach((score) => {
      const idCombat = String(score.id_combat);
      scoresByCombatId.set(idCombat, [...(scoresByCombatId.get(idCombat) || []), score]);
    });

    const groqQuery = await parseCoachChatQueryWithGroq(question);
    if (groqQuery) {
      return executeCoachChatQuery(
        groqQuery,
        judokaRows,
        competitionRows,
        combatRows,
        scoresByCombatId
      );
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
          : "Aucune prise détaillée";
        return [
          {
            judokaId: String(combat.id_judoka || ""),
            judokaName: formatJudokaName(judoka),
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

  async function parseCoachChatQueryWithGroq(question: string): Promise<CoachChatQuery | null> {
    if (!groqClient) {
      return null;
    }
    try {
      const content = await groqClient.generateChatCompletion([
        {
          role: "system",
          content:
            "Tu transformes une question de coach de judo en JSON strict. " +
            "Retourne uniquement un objet JSON avec entity, filters et limit. " +
            "entity vaut judokas, combats ou competitions. " +
            "Si la question demande une liste de judokas, entity=judokas. " +
            "Si elle demande des combats, entity=combats. " +
            "Si elle demande des compétitions ou tournois, entity=competitions. " +
            "filters peut contenir ageCategory, beltColor, categoryYear, competitionDate, competitionLevel, gender, handedness, neWazaType, opponent, opponentStance, result, scoreValue, tachiWazaTechnique, victoryType, text. " +
            "Utilise les valeurs métier françaises exactes quand elles sont connues: Minime, Cadet, Victoire, Défaite, Osaekomi, Ippon, etc. " +
            "Pour aujourd'hui, mets competitionDate=today. Pour les mots libres, mets un tableau text."
        },
        {
          role: "user",
          content: question
        }
      ]);
      return normalizeCoachChatQuery(content);
    } catch (error) {
      console.error("Échec de l'interprétation Groq du chat coach :", error);
      return null;
    }
  }

  function normalizeCoachChatQuery(rawContent: string): CoachChatQuery | null {
    const raw = String(rawContent || "").trim();
    if (!raw) {
      return null;
    }
    const jsonText = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return null;
    }
    const entity = parsed?.entity;
    if (entity !== "judokas" && entity !== "combats" && entity !== "competitions") {
      return null;
    }
    const filters = parsed?.filters && typeof parsed.filters === "object" ? parsed.filters : {};
    const text = Array.isArray(filters.text)
      ? filters.text.map((term: unknown) => String(term || "").trim()).filter(Boolean)
      : [];
    const competitionDate =
      String(filters.competitionDate || "").trim() === "today"
        ? getCurrentDate()
        : String(filters.competitionDate || "").trim();
    return {
      entity,
      filters: {
        ageCategory: String(filters.ageCategory || "").trim() || undefined,
        beltColor: String(filters.beltColor || "").trim() || undefined,
        categoryYear: String(filters.categoryYear || "").trim() || undefined,
        competitionDate: competitionDate || undefined,
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
      },
      limit: Math.min(Math.max(Number(parsed?.limit) || 12, 1), 20)
    };
  }

  function executeCoachChatQuery(
    query: CoachChatQuery,
    judokaRows: Array<Record<string, unknown>>,
    competitionRows: Array<Record<string, unknown>>,
    combatRows: Array<Record<string, unknown>>,
    scoresByCombatId: Map<string, CombatScoreRow[]>
  ): CoachAssistantResponse {
    const competitionsById = new Map(
      competitionRows.map((competition) => [String(competition.id_competition), competition])
    );
    const judokasById = new Map(judokaRows.map((judoka) => [String(judoka.id_judoka), judoka]));
    if (query.entity === "judokas") {
      const matches = searchCoachJudokas(query, judokaRows, combatRows, competitionsById, scoresByCombatId);
      return {
        answer: formatEntityAnswer("judoka", matches.length, query.limit),
        matches,
        beta: true
      };
    }
    if (query.entity === "competitions") {
      const matches = searchCoachCompetitions(query, competitionRows, combatRows, judokasById, scoresByCombatId);
      return {
        answer: formatEntityAnswer("compétition", matches.length, query.limit),
        matches,
        beta: true
      };
    }
    const matches = searchCoachCombats(query, combatRows, judokasById, competitionsById, scoresByCombatId);
    return {
      answer: formatEntityAnswer("combat", matches.length, query.limit),
      matches,
      beta: true
    };
  }

  function searchCoachJudokas(
    query: CoachChatQuery,
    judokaRows: Array<Record<string, unknown>>,
    combatRows: Array<Record<string, unknown>>,
    competitionsById: Map<string, Record<string, unknown>>,
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
        const competition = relatedCombat ? competitionsById.get(String(relatedCombat.id_competition)) : undefined;
        return [toAssistantMatch(judoka, relatedCombat, competition, relatedCombat ? scoresByCombatId.get(String(relatedCombat.id_combat)) || [] : [])];
      })
      .sort((a, b) => a.judokaName.localeCompare(b.judokaName))
      .slice(0, query.limit);
  }

  function searchCoachCombats(
    query: CoachChatQuery,
    combatRows: Array<Record<string, unknown>>,
    judokasById: Map<string, Record<string, unknown>>,
    competitionsById: Map<string, Record<string, unknown>>,
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
    competitionRows: Array<Record<string, unknown>>,
    combatRows: Array<Record<string, unknown>>,
    judokasById: Map<string, Record<string, unknown>>,
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
        competitionId: String(competition.id_competition || ""),
        competitionName: String(competition.nom || ""),
        competitionDate: String(competition.date || ""),
        opponent: "",
        result: "",
        victoryType: "",
        scoreLabel: [competition.categorie_age, competition.niveau, competition.classement].filter(Boolean).join(" · ")
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
        query.filters.handedness
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

  function matchesJudokaFilters(judoka: Record<string, unknown> | undefined, query: CoachChatQuery): boolean {
    if (!judoka) {
      return false;
    }
    if (query.filters.ageCategory && String(judoka.categorie_age || "") !== query.filters.ageCategory) {
      return false;
    }
    if (query.filters.beltColor && String(judoka.couleur_ceinture || "") !== query.filters.beltColor) {
      return false;
    }
    if (query.filters.categoryYear && String(judoka.annee_categorie || "") !== query.filters.categoryYear) {
      return false;
    }
    if (query.filters.gender && String(judoka.genre || "") !== query.filters.gender) {
      return false;
    }
    if (query.filters.handedness && String(judoka.lateralite || "") !== query.filters.handedness) {
      return false;
    }
    return true;
  }

  function matchesCompetitionFilters(competition: Record<string, unknown> | undefined, query: CoachChatQuery): boolean {
    if (!competition) {
      return false;
    }
    if (query.filters.competitionDate && String(competition.date || "") !== query.filters.competitionDate) {
      return false;
    }
    if (query.filters.competitionLevel && String(competition.niveau || "") !== query.filters.competitionLevel) {
      return false;
    }
    return true;
  }

  function matchesCombatFilters(
    combat: Record<string, unknown>,
    scores: CombatScoreRow[],
    judoka: Record<string, unknown> | undefined,
    competition: Record<string, unknown> | undefined,
    query: CoachChatQuery
  ): boolean {
    if (!matchesJudokaFilters(judoka || {}, query)) {
      return false;
    }
    if (!matchesCompetitionFilters(competition || {}, query)) {
      return false;
    }
    if (query.filters.result && String(combat.resultat || "") !== query.filters.result) {
      return false;
    }
    if (query.filters.victoryType && String(combat.type_victoire || "") !== query.filters.victoryType) {
      return false;
    }
    if (query.filters.opponentStance && String(combat.garde_adversaire || "") !== query.filters.opponentStance) {
      return false;
    }
    if (query.filters.opponent && !normalizeAssistantSearchText(combat.adversaire).includes(normalizeAssistantSearchText(query.filters.opponent))) {
      return false;
    }
    if (query.filters.neWazaType && !scores.some((score) => String(score.type_ne_waza || "") === query.filters.neWazaType)) {
      return false;
    }
    if (query.filters.tachiWazaTechnique && !scores.some((score) => String(score.technique || "") === query.filters.tachiWazaTechnique)) {
      return false;
    }
    if (query.filters.scoreValue && !scores.some((score) => String(score.valeur || "") === query.filters.scoreValue)) {
      return false;
    }
    const textTerms = query.filters.text || [];
    if (textTerms.length) {
      const searchText = buildAssistantSearchText(combat, scores, judoka, competition);
      if (!textTerms.every((term) => searchText.includes(normalizeAssistantSearchText(term).trim()))) {
        return false;
      }
    }
    return true;
  }

  function toAssistantMatch(
    judoka: Record<string, unknown> | undefined,
    combat: Record<string, unknown> | undefined,
    competition: Record<string, unknown> | undefined,
    scores: CombatScoreRow[]
  ): CoachAssistantMatch {
    return {
      judokaId: String(judoka?.id_judoka || combat?.id_judoka || ""),
      judokaName: formatJudokaName(judoka),
      competitionId: String(competition?.id_competition || combat?.id_competition || ""),
      competitionName: String(competition?.nom || ""),
      competitionDate: String(competition?.date || ""),
      opponent: String(combat?.adversaire || ""),
      result: String(combat?.resultat || ""),
      victoryType: String(combat?.type_victoire || ""),
      scoreLabel: scores.length ? scores.map(formatScoreLabel).join(", ") : String(judoka?.categorie_age || "")
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
      "moi",
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
    return /\b(liste|lister|affiche|afficher|montre|montrer|qui)\b/.test(query) && /\bjudoka|judokas\b/.test(query);
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

  function buildJudokaListMatches(
    judokaRows: Array<{
      id_judoka?: string;
      prenom?: string;
      nom?: string;
      categorie_age?: string;
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
    const combatByJudokaId = new Map<string, { competitionId: string; competitionName: string; competitionDate: string }>();
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
      .filter((judoka) => !requestedAgeCategory || String(judoka.categorie_age || "") === requestedAgeCategory)
      .filter((judoka) => !requestedDate || combatByJudokaId.has(String(judoka.id_judoka || "")))
      .map((judoka) => {
        const combatInfo = combatByJudokaId.get(String(judoka.id_judoka || ""));
        return {
          judokaId: String(judoka.id_judoka || ""),
          judokaName: formatJudokaName(judoka),
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
    ].filter(Boolean).join(" + ");
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
    combat: {
      id_judoka?: string;
      id_competition?: string;
      adversaire?: string;
      garde_adversaire?: string;
      resultat?: string;
      type_victoire?: string;
      deroule?: string;
    },
    scores: CombatScoreRow[],
    judoka:
      | {
          id_judoka?: string;
          email?: string;
          prenom?: string;
          nom?: string;
          role?: string;
          profile_type?: string;
          categorie_age?: string;
          categorie_poids?: string;
          couleur_ceinture?: string;
          genre?: string;
          annee_categorie?: string;
          lateralite?: string;
        }
      | undefined,
    competition:
      | {
          id_competition?: string;
          nom?: string;
          date?: string;
          categorie_age?: string;
          categorie_poids?: string;
          niveau?: string;
          classement?: string;
          coach_objective?: string;
          coach_review?: string;
        }
      | undefined
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
        ? String(score.type_ne_waza || "Ne-waza")
        : String(score.technique || "Tachi-waza");
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
    if (!matches.length) {
      return `Aucun combat trouvé pour ${criteria}.`;
    }
    const suffix = matches.length >= 12 ? " Les 12 résultats les plus récents sont affichés." : "";
    return `${distinctJudokas} judoka(s) trouvé(s), ${matches.length} combat(s) correspondant à ${criteria}.${suffix}`;
  }

  return {
    methods: { askCoachAssistant, getCoachDashboard }
  };
}
