# Questions coach — chat Kiroku

5 questions qu'un coach voudrait poser via le chat, choisies pour rester dans le périmètre actuel des filtres (`core/prompts/coach-chat-prompts.ts`) : judokas, compétitions, combats.

1. **« Quels judokas n'ont pas combattu depuis plus de 2 mois ? »**
   Repérer les licenciés qui décrochent, pour relancer leur engagement avant qu'ils arrêtent.

2. **« Quelles sont les techniques de Ne-waza les plus utilisées par mes ceintures bleues cette saison ? »**
   Identifier les points forts par niveau de grade pour adapter le contenu des cours.

3. **« Qui a perdu deux fois contre le même adversaire ? »**
   Détecter un point faible récurrent à travailler avant une revanche en compétition.

4. **« Quel est le taux de victoire par Ippon des Minimes en compétition Régionale vs Départementale ? »**
   Évaluer si le niveau de jeu monte avec l'enjeu, pour calibrer la préparation mentale.

5. **« Quels judokas gauchers ont un mauvais ratio victoires/défaites contre des droitiers ? »**
   Cibler le travail de Kumi-kata et d'adaptation de garde à l'entraînement.

## Limite actuelle

Les questions 1, 3 et 4 demandent une agrégation (compter, comparer un ratio, regrouper par grade/niveau) que le routeur MCP actuel ne fait pas : il choisit un seul outil de recherche (`judokas`/`competitions`/`combats`) et renvoie une liste filtrée, sans calcul côté serveur. Pour y répondre fidèlement il faudrait soit enrichir les outils MCP avec des agrégations, soit laisser le modèle agréger lui-même à partir d'une liste de combats bruts (risque d'erreur de comptage sur de gros volumes).
