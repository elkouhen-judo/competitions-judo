# Agenda FFJDA — conception

Date : 2026-11-22 · Statut : validé en conversation, en attente de relecture du document.

## Intention

Offrir dans Ayumi un **agenda des événements FFJDA** (compétitions, passages de grade, stages, formations, kata) consultable en lecture seule, mis à jour automatiquement chaque jour, sans saisie manuelle.

Pourquoi : les événements fédéraux, régionaux et départementaux ne sont visibles que sur les sites ffjudo.com, éparpillés par ligue et comité. La FFJDA ne publie aucune API (vérifié : pas de documentation, pas de flux iCal/RSS, Mon Compte Judo rend tout côté serveur).

## Objectifs

- AGD-1 : afficher les événements à venir, triés par date, groupés par mois.
- AGD-2 : filtrer par **ligue** (demande explicite), par type d'événement et par mois.
- AGD-3 : synchroniser automatiquement une fois par jour.
- AGD-4 : réservé aux coachs (décision du porteur, 2026-11-22) ; les autres profils ne voient pas l'entrée et le serveur leur refuse la lecture.

## Non-objectifs

- Pas de lien avec les compétitions de club (COMP-019) ni pré-remplissage.
- Pas d'inscription, pas d'édition, pas de notification.
- Pas d'interprétation du niveau FFJDA (`F` / `L` / `D` / `CL`) : les codes ne correspondent pas à nos niveaux (un « tournoi national kata » est codé `D`).

## Anti-objectifs

- Stocker des données personnelles d'organisateurs (`contactNom`, `contactTelephone`, `contactEmail`) : interdit.
- Charger les sites FFJDA : au plus ~7 requêtes par synchro, une par jour, avec délai entre requêtes.
- Effacer l'agenda quand une source tombe en panne.

## Contraintes

- Légal : l'accord de la FFJDA est demandé par le porteur du projet (e-mail à judo@ffjudo.com). Pas de déploiement prod de la synchro sans son feu vert. Chaque événement renvoie à sa page FFJDA d'origine.
- `robots.txt` : les ligues n'interdisent que `/admin` ; le national interdit `*?mois=*` et `/recherches?search=*` → on n'utilise que `/evenement` (ligues) et `/evenements/agenda/N` (national).
- Plateforme : Vercel Hobby (12 fonctions max, 10 utilisées ; cron au plus quotidien) ; Supabase côté serveur uniquement (SEC-001 à SEC-005).
- Architecture : domaine dans `core/domain`, orchestration dans `core/services`, persistance dans `core/repositories` (ARC-005 à ARC-008) ; vues Vue dans `assets/views/*.html` (ARC-001) ; schéma dans le fichier canonique unique de `supabase/migrations` (ARC-003).
- Règles projet : `npm run build:core` avant tests après modification de `core/**/*.ts` ; patterns verrouillés des tests `mobile-first-index` et `vercel-deployment`.

## Sources (constat du 2026-11-22)

| Source | URL | Format |
|---|---|---|
| Ligue Pays de la Loire | `https://pays-de-la-loire-judo.ffjudo.com/evenement` | JSON intégré |
| Ligue Bretagne | `https://judo-bretagne.ffjudo.com/evenement` | JSON intégré |
| Ligue Nouvelle-Aquitaine | `https://nouvelle-aquitaine-judo.ffjudo.com/evenement` | JSON intégré |
| National | `https://www.ffjudo.com/evenements/agenda/{1..N}` (~24/page, 4 pages) | HTML seul |

**Pages ligues** : un champ caché `<input type="hidden" name="evenements" value='…'>` du formulaire `agenda__export` contient un JSON `{année: {mois: [événement…]}}`, entités HTML encodées. Attention : la valeur peut contenir des apostrophes non échappées après décodage ; il faut d'abord décoder les entités puis lire le JSON par décodage incrémental depuis le début de la valeur (pas de regex jusqu'à `'`).

Champs utiles d'un événement :

- `type` : `federal` (issu de l'extranet fédéral, porte un `id` fédéral stable entre sites) ou `local` (propre au site, `id` vide, identifié par `id_evenement` + site).
- `id`, `id_evenement`, `slug`, `titre`, `lieu`, `adresse1`, `codePostal`, `ville`.
- `date_debut`, `date_fin`, `dateOuverture`, `dateCloture` : timestamps Unix (secondes) en chaîne, parfois vides.
- `libelleType` (`COMPETITION`, `PASSAGE DE GRADE`, `STAGE`, `FORMATION`, `KATA SPORTIF`, `AUTRES`) et `code` (`C`, `PG`, `ST`, `FO`, `KS`, `AN`).
- `proprietaire` : « Ligue PAYS-DE-LA-LOIRE JUDO », « Comité VENDEE JUDO »… (libellés tronqués : « Comité LOIRE ATLANTIQUE JUD »).
- `discipline`, `siteWeb`.
- À ignorer : `contactNom`, `contactTelephone`, `contactEmail`, `contenu`, `intro`, `image`, `pdf`, `meta_*`, `commentaires`.

Chaque ligue publie aussi des événements d'autres ligues ; 111 des 264 événements distincts apparaissent sur plusieurs sites. Lien de détail : `https://<site>.ffjudo.com/evenement/<slug>/<id_evenement>`.

**Page nationale** : cartes `a.agenda__list__item` (lien `https://www.ffjudo.com/evenement/<slug>`), titre `.agenda__list__item__title`, jour `.agenda__list__item__date__day` (`dd.mm`, année à déduire), lieu `.agenda__list__item__lieu`, catégorie `.agenda__list__item__categorie`. Pagination `/evenements/agenda/N`, dernière page lue dans `li.page.last`. Ces événements ne sont pas dans les JSON des ligues (0 recouvrement sur 24).

## Approches envisagées

1. **Cron Vercel + fonction dédiée** *(retenue)* : `api/ffjudo-sync.js` appelée une fois par jour par Vercel Cron, protégée par `CRON_SECRET`. Reste dans la pile actuelle, journaux Vercel, 11/12 fonctions.
2. Cron macOS local (comme la sauvegarde BKP-003) : dépend du Mac allumé. Écartée.
3. GitHub Actions planifié : secrets Supabase hors Vercel, autre lieu de journaux. Écartée.
4. Supabase pg_cron + Edge Function : nouveau runtime (Deno) absent du projet. Écartée.

Choix fait par l'assistant, le porteur ayant délégué le « comment ».

## Conception

### Données

Nouvelle table `ffjudo_events` dans la migration canonique (idempotente), grants `service_role` uniquement (SEC-002/003) :

| Colonne | Type | Note |
|---|---|---|
| `event_key` | text PK | `fed:<id>` pour `federal` ; `loc:<host>:<id_evenement>` pour `local` ; `nat:<slug>:<date>` pour le national |
| `titre` | text not null | |
| `date_debut` | date not null | |
| `date_fin` | date | |
| `inscription_ouverture`, `inscription_cloture` | date | |
| `type_evenement` | text | libellé FFJDA (`COMPETITION`…), vide si inconnu |
| `lieu`, `ville`, `code_postal` | text | |
| `proprietaire` | text | libellé FFJDA brut |
| `ligue` | text | ligue de rattachement résolue (voir ci-dessous), vide si inconnue |
| `source_url` | text not null | page FFJDA de l'événement |
| `site_web` | text | |
| `sources` | text[] | sites où l'événement a été vu |
| `synced_at` | timestamptz not null | dernière synchro qui l'a vu |

Table `ffjudo_sync_runs` (journal) : `started_at`, `finished_at`, statut par source (`ok` / `error` + message), nombre d'événements. Sert à afficher « dernière mise à jour le … » et à diagnostiquer.

### Rattachement à une ligue

Module domaine `core/domain/ffjudo-ligues.ts` : liste des 13 ligues métropolitaines + ligues d'outre-mer, et correspondance comité → ligue (normalisation : majuscules, sans accents, tolérance aux libellés tronqués par préfixe). `proprietaire` « Ligue X JUDO » → X ; « Comité Y » → ligue de Y ; national → `National`. Libellé inconnu → `ligue` vide, l'événement reste visible sous « Autre ».

### Synchro (`core/services/ffjudo-sync.service.ts`)

1. Pour chaque source, séquentiellement, avec ~1 s entre requêtes, `User-Agent` explicite d'Ayumi sans donnée personnelle, timeout par requête.
2. Analyse (`core/domain/ffjudo-event-parser.ts`, fonctions pures) → événements normalisés, contacts écartés à l'analyse.
3. Fusion par `event_key` (union des `sources`).
4. Écriture : upsert par `event_key` ; puis suppression des événements **futurs** dont toutes les sources ont réussi et qui n'ont pas été revus. Si une source a échoué, ses événements sont conservés.
5. Journal dans `ffjudo_sync_runs`.

Point d'entrée `api/ffjudo-sync.js` : refuse toute requête sans `Authorization: Bearer <CRON_SECRET>`. `vercel.json` : `crons: [{ path: "/api/ffjudo-sync", schedule: "0 4 * * *" }]`, `maxDuration` adapté. Lancement manuel possible sur dev avec le secret.

### Lecture

Méthode RPC `getFfjudoEvents` (coachs uniquement) : événements avec `date_debut >= aujourd'hui`, ordre `date_debut, titre`, pagination conforme à PERF-003, plus date de dernière synchro réussie. Le filtrage (ligue, type, mois) se fait côté navigateur sur la liste reçue (quelques centaines d'éléments).

### Écran

Nouvelle vue `assets/views/ffjudo-agenda.html` + `assets/app-screen-ffjudo-agenda.ts`, ouverte depuis l'accueil (entrée « Agenda FFJDA » visible pour les coachs), retour standard.

```
← Agenda FFJDA
[Ligue ▾] [Type ▾] [Mois ▾]
Mis à jour le 22/11/2026 à 04:00

DÉCEMBRE 2026
┌──────────────────────────────┐
│ 06/12  TOURNOI DE POUZAUGES  │
│ Pouzauges · Compétition      │
│ Comité Vendée — Pays de la L.│
│ Voir sur ffjudo.com ↗        │
└──────────────────────────────┘
```

États : chargement, vide (« Aucun événement à venir » / « Aucun résultat pour ces filtres »), erreur (message + réessayer), hors ligne (dernière liste en cache si disponible, sinon message explicite, VCL-013). Mobile first.

## Laissé au constructeur

- Emplacement exact de l'entrée sur l'accueil, en respectant UIX-015/016/018 et les patterns verrouillés de `showHome()`.
- Mise en cache hors ligne de la liste (cohérente avec VCL-014/016).
- Valeurs de timeout et `maxDuration`.
- Forme exacte du `User-Agent`.

## Tests attendus

- Analyseur ligue et national sur des copies figées des pages réelles (`tests/fixtures/`, contacts retirés des fixtures).
- Cas limites : apostrophe dans le JSON, dates vides, événement `local`, doublon multi-sites, libellé de comité tronqué ou inconnu, page nationale vide.
- Synchro : source en échec → données conservées ; disparition d'un événement → suppression seulement si toutes ses sources ont réussi.
- Sécurité : `api/ffjudo-sync` refuse sans secret ; tables non accessibles à `anon` / `authenticated`.
- `tests/vercel-deployment.test.js` : nombre de fonctions ≤ 12, cron déclaré.
- Captures avant/après à 375 px et desktop (`output/playwright/`).

## Documentation à mettre à jour

- `docs/spec.md` : nouvelle section de règles `AGD-*`.
- `docs/spec-tech.md` : tables `ffjudo_events` / `ffjudo_sync_runs`, fonction et cron, `CRON_SECRET` (CFG), règle d'exclusion des contacts.

## Retour arrière

Retirer l'entrée cron de `vercel.json` stoppe la synchro ; masquer l'entrée d'accueil retire l'écran ; les tables sont indépendantes des tables métier et peuvent être vidées sans impact.
