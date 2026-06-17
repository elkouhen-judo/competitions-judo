import { toCanonicalCombat, toCanonicalCompetition } from "./domain-adapters";
import type { CombatsRepository } from "../repositories/combats.repository";
import type { CombatScoresRepository } from "../repositories/combat-scores.repository";
import type { CompetitionsRepository } from "../repositories/competitions.repository";
import type { Combat, CombatScore, Competition } from "../types";

export interface GroqClient {
  generateChatCompletion(messages: { role: string; content: string }[]): Promise<string>;
}

export interface AiAnalysisServiceDeps {
  combatsRepository: CombatsRepository;
  combatScoresRepository: CombatScoresRepository;
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

Rédige une analyse en français de 80 à 120 mots maximum avec un ton factuel, bienveillant et encourageant, adapté à un jeune sportif et à son entourage. Sois synthétique : une seule phrase clé par idée, aucune répétition entre les parties, aucune phrase de remplissage.

La réponse doit contenir 3 parties synthétiques, sans utiliser de titres.

1. Bilan général

* En une ou deux phrases, résume la performance globale en tenant compte du classement final et du bilan victoires/défaites, en restant objectif et positif.

2. Tendances observées pendant la compétition

* En une ou deux phrases, mets en évidence les éléments qui se répètent parmi :

  * techniques qui fonctionnent régulièrement ;
  * techniques subies de manière récurrente ;
  * types d'adversaires ou gardes fréquemment rencontrés ;
  * combats particulièrement décisifs ou révélateurs.
* Base-toi uniquement sur les données fournies ; ne cite que les éléments les plus marquants.

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

function describeCombatScore(score: CombatScore): string {
  const detail =
    score.category === "Tachi-waza"
      ? score.technique || "technique non précisée"
      : score.neWazaType || "ne-waza";
  return `${detail} (${score.value || "valeur non précisée"})`;
}

function describeCombat(combat: Combat, index: number): string {
  const parts = [`Résultat : ${combat.result || "inconnu"}`];
  if (combat.opponentStance) {
    parts.push(`garde de l'adversaire : ${combat.opponentStance}`);
  }
  if (combat.victoryType) {
    parts.push(`décision : ${combat.victoryType}`);
  }
  if (combat.scores && combat.scores.length) {
    parts.push(`prises marquées : ${combat.scores.map(describeCombatScore).join(", ")}`);
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
  const { combatsRepository, combatScoresRepository, competitionsRepository, groqClient } = deps;

  async function generateCompetitionAnalysis(idCompetition: string): Promise<string | null> {
    const competitionRow = await competitionsRepository.getById(idCompetition);
    if (!competitionRow) {
      return null;
    }

    const competition = toCanonicalCompetition(competitionRow);
    const combatRows = await combatsRepository.listByCompetition(idCompetition);
    const combatScores = await combatScoresRepository.listByCombatIds(
      combatRows.map((combat) => combat.id_combat)
    );
    const scoresByCombatId = new Map<string, typeof combatScores>();
    combatScores.forEach((score) => {
      const idCombat = String(score.id_combat);
      scoresByCombatId.set(idCombat, [...(scoresByCombatId.get(idCombat) || []), score]);
    });
    const combats = combatRows.map((combat) =>
      toCanonicalCombat({
        ...combat,
        scores: scoresByCombatId.get(String(combat.id_combat)) || []
      })
    );

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
