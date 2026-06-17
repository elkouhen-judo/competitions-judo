import { toCanonicalCombat, toCanonicalCompetition } from "./domain-adapters";
import type { CombatsRepository } from "../repositories/combats.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { Combat, Competition } from "../types";

export interface GroqClient {
  generateChatCompletion(messages: { role: string; content: string }[]): Promise<string>;
}

export interface AiAnalysisServiceDeps {
  combatsRepository: CombatsRepository;
  competitionsRepository: CompetitionsRepository;
  groqClient: GroqClient;
}

export interface AiAnalysisService {
  generateCompetitionAnalysis(idCompetition: string): Promise<string | null>;
}

const SYSTEM_PROMPT = `Tu es un analyste technique spécialisé en judo jeunesse. Tu rédiges un bilan de compétition court, pédagogique et exploitable pour trois publics : le jeune judoka, ses parents et son entraîneur.

Tu reçois les informations suivantes :

* compétition : nom, date (si disponible), niveau, catégorie d'âge, catégorie de poids, classement final ;
* bilan global : nombre de victoires, défaites et égalités (si disponible) ;
* liste des combats disputés :

  * adversaire ;
  * garde de l'adversaire (si connue) ;
  * résultat (victoire, défaite ou égalité) ;
  * type de décision (ippon, waza-ari, pénalités, décision arbitrale, etc.) ;
  * famille de techniques gagnantes ou subies (projection, immobilisation, étranglement, clé de bras, etc.) ;
  * notes complémentaires éventuelles.

Rédige une analyse en français de 180 à 250 mots avec un ton factuel, bienveillant et encourageant, adapté à un jeune sportif et à son entourage.

La réponse doit contenir 3 parties synthétiques, sans utiliser de titres.

1. Bilan général

* Résume la performance globale en tenant compte du classement final et du bilan victoires/défaites.
* Situe la prestation de manière objective et positive.
* Valorise les points forts observables.

2. Tendances observées pendant la compétition

* Mets en évidence les éléments qui se répètent :

  * techniques qui fonctionnent régulièrement ;
  * techniques subies de manière récurrente ;
  * types d'adversaires ou gardes fréquemment rencontrés ;
  * combats particulièrement décisifs ou révélateurs.
* Base-toi uniquement sur les données fournies.

3. Score de confiance de l'analyse

Ajoute une dernière phrase sous la forme :

**Score de confiance : Faible | Moyen | Élevé**

Détermine ce score selon la quantité et la qualité des données disponibles :

* Faible : 1 ou 2 combats ou peu d'informations exploitables.
* Moyen : 3 ou 4 combats avec quelques tendances observables.
* Élevé : 5 combats ou plus avec des tendances récurrentes clairement identifiables.

Règles importantes :

* N'invente jamais d'informations absentes.
* Si les données sont insuffisantes, indique-le brièvement au lieu de spéculer.
* Ne formule pas de critiques culpabilisantes.
* Évite le jargon trop technique ; privilégie un vocabulaire compréhensible par des parents.
* Ne mentionne pas les limites des données si cela n'impacte pas directement l'analyse.
* L'objectif est de produire un retour utile, motivant et facile à comprendre.`;

function describeCombat(combat: Combat, index: number): string {
  const parts = [`Résultat : ${combat.result || "inconnu"}`];
  if (combat.opponentStance) {
    parts.push(`garde de l'adversaire : ${combat.opponentStance}`);
  }
  if (combat.victoryType) {
    parts.push(`décision : ${combat.victoryType}`);
  }
  if (combat.techniqueCategory) {
    parts.push(`technique : ${combat.techniqueCategory}`);
  }
  if (combat.notes) {
    parts.push(`notes : ${combat.notes}`);
  }
  const opponent = combat.opponent || "adversaire non renseigné";
  return `${index + 1}. Contre ${opponent} — ${parts.join(", ")}.`;
}

function buildUserPrompt(competition: Competition, combats: Combat[]): string {
  const header = [
    `Compétition : ${competition.name || "Sans nom"}`,
    `Catégorie d'âge : ${competition.ageCategory || "non renseignée"}`,
    `Catégorie de poids : ${competition.weightCategory || "non renseignée"}`,
    `Niveau : ${competition.level || "non renseigné"}`,
    `Classement final : ${competition.result || "non classé"}`
  ].join("\n");

  if (!combats.length) {
    return `${header}\n\nAucun combat n'a été enregistré pour cette compétition.`;
  }

  const combatLines = combats.map(describeCombat).join("\n");
  return `${header}\n\nCombats (${combats.length}) :\n${combatLines}`;
}

export default function createAiAnalysisService(deps: AiAnalysisServiceDeps): AiAnalysisService {
  const { combatsRepository, competitionsRepository, groqClient } = deps;

  async function generateCompetitionAnalysis(idCompetition: string): Promise<string | null> {
    const competitionRow = await competitionsRepository.getById(idCompetition);
    if (!competitionRow) {
      return null;
    }

    const competition = toCanonicalCompetition(competitionRow);
    const combatRows = await combatsRepository.listByCompetition(idCompetition);
    const combats = combatRows.map(toCanonicalCombat);

    const analysis = await groqClient.generateChatCompletion([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(competition, combats) }
    ]);

    const trimmedAnalysis = analysis.trim();
    if (!trimmedAnalysis) {
      return null;
    }

    await competitionsRepository.updateAiAnalysis(idCompetition, trimmedAnalysis);
    return trimmedAnalysis;
  }

  return {
    generateCompetitionAnalysis
  };
}
