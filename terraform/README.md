# Terraform — infrastructure Kiroku

Gère en code la configuration des deux projets Vercel (`competitions-judo` /
prod, `competitions-judo-dev` / dev — voir `docs/spec-tech.md` VCL-005b) et
les réglages Auth des deux projets Supabase associés (CFG-011).

## Structure

```
terraform/
  modules/kiroku_project/   # code partagé, générique : aucune valeur d'environnement
  environments/prod/        # state, providers et valeurs prod — déployable seul
  environments/dev/         # state, providers et valeurs dev — déployable seul
```

`modules/kiroku_project` ne contient ni nom de projet, ni URL, ni ref Supabase
en dur : tout est reçu en variables depuis l'environnement appelant. Chaque
répertoire sous `environments/` est un root module indépendant avec son propre
state local (`terraform init`/`plan`/`apply` s'exécutent séparément dans
chacun) — modifier ou déployer `prod` ne touche jamais l'état de `dev`, et
inversement.

## Périmètre volontairement limité

- **Vercel** : nom du projet et `node_version` uniquement. Les commandes de
  build/install et le routing restent pilotés par `vercel.json` (VCL-006,
  VCL-006a) — une seule source de vérité.
- **Supabase** : `site_url` et `uri_allow_list` (Auth redirects), reflet de
  CFG-005/CFG-006/CFG-006a/CFG-006b.
- **Hors périmètre** : création des projets Vercel/Supabase eux-mêmes (faite
  manuellement, déjà existants), variables d'environnement sensibles
  (`SUPABASE_SERVICE_ROLE_KEY`, `MCP_JWT_SECRET`, etc.), le hook Auth
  `before-user-created` (porté par la migration SQL, pas par ce provider).

### Pourquoi les secrets sont hors périmètre

Le `vercel_project_environment_variable` du provider Vercel peut gérer des
variables sensibles, mais leur valeur est alors stockée en clair dans le
fichier d'état Terraform (`.tfstate`, local et jamais commité ici). Pour ce
projet, le risque de fuite via un `.tfstate` mal protégé a été jugé supérieur
au bénéfice : les secrets restent gérés via `vercel env` / le dashboard, comme
aujourd'hui (`npm run db:pull-env:prod` / `:dev`).

## Pré-requis

- Terraform >= 1.9 (`tfenv install` lit la version depuis ce repo si besoin).
- Un token API Vercel : <https://vercel.com/account/tokens>, scope = team
  `team_RvEgPCDetancG3mzS4xHRnTs`.
- Un token Supabase Management API : Dashboard Supabase → Account → Access
  Tokens.
- Le project ref du projet Supabase **dev** (sous-domaine dans son URL
  `https://<ref>.supabase.co`) — pas déductible des fichiers locaux, à
  récupérer dans le dashboard Supabase du projet dev. Le ref prod a déjà une
  valeur par défaut dans `environments/prod/variables.tf`.

Exporter les secrets en variables d'environnement plutôt que dans un fichier :

```sh
export TF_VAR_vercel_api_token=...
export TF_VAR_supabase_access_token=...
# équivalent natif aussi supporté par les providers :
export VERCEL_API_TOKEN=...
export SUPABASE_ACCESS_TOKEN=...
```

Dans `environments/dev/`, copier `terraform.tfvars.example` en
`terraform.tfvars` (gitignoré) pour le seul champ non sensible manquant,
`supabase_project_ref`.

## Premier import (obligatoire avant le premier apply, par environnement)

Les projets Vercel et Supabase existent déjà pour les deux environnements —
**ne jamais** lancer `terraform apply` sans avoir d'abord importé l'état réel
dans l'environnement concerné, sous peine de tentative de
recréation/destruction des ressources existantes.

```sh
cd environments/prod
terraform init
terraform import module.app.vercel_project.this prj_IbhgC3kYGQzAJrYuGnfKCz4ALh8B
terraform import module.app.supabase_settings.auth dqtdbfmehwdexikkblwg
terraform plan   # vérifier l'absence de diff destructif avant tout changement
```

```sh
cd environments/dev
terraform init
terraform import module.app.vercel_project.this prj_7kueNICqzzz4Oc2BbLgegSOkA1gy
terraform import module.app.supabase_settings.auth <ref du projet supabase dev>
terraform plan
```

Si `plan` propose de changer des champs qu'on ne veut pas piloter par
Terraform (ex. `build_command`), c'est probablement le signe qu'il faut
ajuster `modules/kiroku_project/main.tf` pour refléter l'état réel plutôt que
forcer un changement.

## Usage courant

Chaque environnement se pilote indépendamment, depuis son propre répertoire :

```sh
cd environments/prod   # ou environments/dev
terraform plan         # toujours avant apply
terraform apply
```

Un changement de `site_url`/`uri_allow_list` ou de `node_version` doit être
testé sur `dev` avant `prod`.

## État Terraform

Chaque environnement a son propre `terraform.tfstate`, local et gitignoré
(voir `.gitignore`). Pas de secret dans ces états tant que le périmètre
ci-dessus est respecté — protéger quand même les fichiers comme une donnée
sensible (project refs, IDs internes).
