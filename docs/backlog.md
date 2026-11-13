# Backlog statistiques

Les stories STAT-1 à STAT-16 de la revue du 13/11/2026 sont implémentées (règles DASH-006 à DASH-025 de `docs/spec.md`, définitions dans `docs/metrics.md`). Reste une story, conditionnée à une mesure.

## Chargement

### STAT-17 — Lecture des statistiques en un seul appel Supabase (P3, M)

- Constat : un affichage des statistiques fait environ 4 requêtes Supabase en 3 étapes au plus : 2 pour le contexte du coach, 1 pour les compétitions, 1 par tranche de 100 participations pour les combats et leurs points.
- Constat : aucun temps de réponse n'est relevé. La part de Supabase dans la durée de `getCoachDashboard` est inconnue.
- Décision du 13/11/2026 : le calcul reste en TypeScript. Une réécriture en SQL doublerait les règles, sortirait le calcul des tests et compliquerait la « tenue du score » (STAT-6).
- Préalable : relever l'en-tête `Server-Timing` de `getCoachDashboard` avec un compte coach, sur une saison complète. La story n'est lancée que si Supabase pèse plus de la moitié de la durée totale ou plus de 300 ms.
- Règle : une fonction SQL renvoie en un appel les compétitions du périmètre, leurs combats et leurs points, sans rien calculer.
- Règle : la fonction reçoit les clubs et les judokas autorisés, les dates, la catégorie d'âge et les compétitions choisies. Le contrôle d'accès du coach reste fait dans la fonction Vercel, avant l'appel.
- Règle : la fonction n'est appelable que par le rôle service (`service_role`).
- Règle : le calcul des statistiques et ses tests ne changent pas.
- Règle : la migration est déployée sur dev, vérifiée, puis sur prod (`npm run db:deploy`).
- Acceptation : `getCoachDashboard` fait au plus 3 requêtes Supabase (2 pour le contexte, 1 pour les données), quel que soit le nombre de participations.
- Acceptation : les statistiques renvoyées sont identiques à celles de la lecture actuelle, sur les données de dev.
- Acceptation : le relevé `Server-Timing` avant et après est noté dans `docs/metrics.md`.
- Fichiers : `supabase/migrations/`, `core/repositories/combats.repository.ts`, `core/services/coach-dashboard-loader.ts`, `core/services/coach-dashboard.service.ts`, `docs/spec-tech.md`, `docs/supabase-schema.md`, `docs/metrics.md`, `tests/loading-performance.test.js`, `tests/repository-mapping.test.js`.
