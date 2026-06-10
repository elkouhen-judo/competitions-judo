# Configuration Apps Script pour Supabase

L'application Apps Script lit et écrit dans Supabase via l'API REST.

## Secrets

Ne jamais mettre la clé Supabase dans `Code.js`, `Index.html`, Git ou un fichier local committé.

Les valeurs attendues sont des Script Properties Apps Script :

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Pour le projet actuel :

```text
SUPABASE_URL=https://dqtdbfmehwdexikkblwg.supabase.co
```

`SUPABASE_SERVICE_ROLE_KEY` doit être récupérée dans Supabase, puis ajoutée dans les propriétés du script Apps Script.

## Configuration manuelle

Dans l'éditeur Apps Script :

1. Ouvrir les paramètres du projet.
2. Aller dans Script Properties.
3. Ajouter `SUPABASE_URL`.
4. Ajouter `SUPABASE_SERVICE_ROLE_KEY`.

## Configuration par fonction temporaire

Il est aussi possible d'exécuter temporairement une fonction Apps Script comme :

```javascript
function configureSupabaseOnce() {
  PropertiesService.getScriptProperties().setProperties({
    SUPABASE_URL: "https://dqtdbfmehwdexikkblwg.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "COLLER_LA_CLE_ICI"
  });
}
```

Cette fonction ne doit pas être commitée avec une vraie clé.

## Sécurité

La clé `service_role` contourne Row Level Security. Elle reste acceptable ici uniquement parce que :

- elle est stockée côté serveur dans Apps Script ;
- elle n'est jamais envoyée à `Index.html` ;
- les règles métier sont vérifiées dans `Code.js` avant chaque opération.

## Import des données

Avant d'utiliser l'application en production avec Supabase :

1. Exécuter `supabase/migrations/20260610000000_initial_schema.sql`.
2. Importer les données dans cet ordre :
   - `judokas`
   - `competitions`
   - `combats`
3. Vérifier que chaque `competitions.id_judoka` existe dans `judokas`.
4. Vérifier que chaque `combats.id_judoka` existe dans `judokas`.
5. Vérifier que chaque `combats.id_competition` existe dans `competitions`.
