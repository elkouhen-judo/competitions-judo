# Backup et restauration Supabase

## Configuration locale

Créer les fichiers ignorés par Git :

```sh
mkdir -p .backup
cp .backup/.env.example .backup/.env.prod
cp .backup/.env.example .backup/.env.dev
```

Renseigner dans chaque fichier `SUPABASE_PROJECT_REF` avec la référence du projet Supabase correspondant. La CLI Supabase authentifiée sur le Mac fournit alors l’accès nécessaire au backup.

Pour la restauration, ajouter aussi `SUPABASE_DB_URL` avec la chaîne PostgreSQL du projet, récupérée depuis Supabase > Connect. Ne jamais mettre cette chaîne dans Git, dans Vercel ou dans une capture d’écran.

## Backup quotidien

Un backup contient le schéma, les données et les rôles exportables. Les fichiers sont écrits dans `backups/supabase/<environment>/<timestamp>/`, avec un manifeste SHA-256. Les sept derniers dossiers sont conservés.

Tester manuellement :

```sh
npm run db:backup:prod
```

Installer le cron quotidien à 02:30 :

```sh
npm run db:backup:cron:install
```

Le log est écrit dans `backups/supabase/cron.log`. Le Mac doit être allumé et le processus utilisateur actif à l’heure prévue.

## Restauration

La restauration par défaut cible l’environnement indiqué par `--target`. Elle exige une confirmation explicite :

```sh
CONFIRM_RESTORE=yes npm run db:restore -- --environment=prod --target=dev --backup=latest
```

Pour remplacer toutes les données applicatives de dev avant import :

```sh
CONFIRM_RESTORE=yes npm run db:restore -- --environment=prod --target=dev --backup=latest --clean=true
```

Avec `SUPABASE_PROJECT_REF`, la restauration passe par la session CLI Supabase authentifiée. Avec `SUPABASE_DB_URL`, elle utilise `psql`.

Pour restaurer la production, ajouter une seconde confirmation :

```sh
CONFIRM_RESTORE=yes CONFIRM_PROD_RESTORE=yes npm run db:restore -- --environment=prod --target=prod --backup=/chemin/vers/backup
```

La restauration réapplique le schéma et les données. Elle ne remplace pas la configuration Supabase Auth, les clés API ni d’éventuels objets Storage. Vérifier ensuite les volumes avec `npm run db:check` et l’authentification dans l’environnement cible.
