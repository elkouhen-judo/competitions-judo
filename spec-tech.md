# Spécification technique

## 1. Surfaces

- `Index.html` : interface web mobile first.
- `api/*` : API serverless Vercel.
- `supabase/migrations/*` : schéma et évolutions Supabase.
- `tests/*` : tests Node.

## 2. Données Supabase

Tables principales :

- `judokas` : identité, email, rôle ;
- `parent_judokas` : liens entre parents et judokas gérés ;
- `competitions` : événements rattachés à `competitions.id_judoka` ;
- `combats` : combats rattachés à `combats.id_judoka` et `combats.id_competition`.

Identifiants métier conservés en texte :

- `judokas.id_judoka` ;
- `parent_judokas.id_parent` ;
- `parent_judokas.id_judoka` ;
- `competitions.id_competition` ;
- `combats.id_combat`.

Relations :

- `competitions.id_judoka` référence le propriétaire ;
- `combats.id_judoka` référence le judoka concerné ;
- `combats.id_competition` référence la compétition ;
- supprimer une compétition supprime automatiquement ses combats.

## 3. Authentification

Vercel :

- connexion Google uniquement via Supabase Auth ;
- callback OAuth Supabase côté navigateur ;
- session Supabase stockée localement ;
- appels métier via `/api/rpc` avec `Authorization: Bearer <access_token>` ;
- l'API vérifie la session avec `/auth/v1/user`, récupère l'email vérifié, puis applique les droits via `judokas`.

Non supporté sur Vercel :

- mot de passe ;
- magic link ;
- bouton de déconnexion dans l'interface.

## 4. Secrets et configuration

Variables Vercel obligatoires :

- `SUPABASE_URL` ;
- `SUPABASE_ANON_KEY` ;
- `SUPABASE_SERVICE_ROLE_KEY`.

Règles de sécurité :

- les appels métier Supabase sont côté serveur ;
- les rôles Supabase `anon` et `authenticated` n'ont pas d'accès direct aux tables métier ;
- les migrations accordent l'accès métier uniquement au rôle serveur `service_role` ;
- `SUPABASE_SERVICE_ROLE_KEY` ne va jamais au navigateur ;
- avec une clé `sb_secret_...`, envoyer `SUPABASE_SERVICE_ROLE_KEY` seulement dans `apikey`, jamais dans `Authorization: Bearer`.

Configuration Google Auth :

- activer le provider Google dans Supabase Auth ;
- configurer `Client ID` et `Client Secret` dans Supabase ;
- autoriser dans Google le callback `https://<project-ref>.supabase.co/auth/v1/callback` ;
- autoriser l'URL Vercel publique dans les redirect URLs Supabase.

## 5. Tests utiles

- `node --test tests/vercel-deployment.test.js` pour les changements Vercel/auth.
- `npm test` pour la suite complète.

Les échecs connus de la suite complète doivent être distingués des régressions introduites par la tâche courante.
