VERCEL    ?= vercel
MIGRATION  = supabase/migrations/20260612000000_initial_schema.sql

# Script Python réutilisable : lit .env.local, extrait le project ref,
# envoie le SQL à la Supabase Management API via urllib (sans dépendance externe)
define PY_SUPABASE_QUERY
import json, os, urllib.request, sys

env = {}
with open('.env.local') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k] = v.strip('"')

url = env.get('SUPABASE_URL') or env.get('NEXT_PUBLIC_SUPABASE_URL', '')
ref = url.replace('https://', '').split('.')[0]
if not ref:
    sys.exit('SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL introuvable dans .env.local — lancez: make db-pull-env')

token = os.environ.get('SUPABASE_ACCESS_TOKEN') or env.get('SUPABASE_ACCESS_TOKEN', '')
if not token:
    sys.exit('SUPABASE_ACCESS_TOKEN non défini.\nCréez un token sur : supabase.com/dashboard/account/tokens')

sql = sys.stdin.read()
payload = json.dumps({'query': sql})
import subprocess, tempfile
with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
    f.write(payload)
    tmpfile = f.name
result = subprocess.run([
    'curl', '-s', '-X', 'POST',
    f'https://api.supabase.com/v1/projects/{ref}/database/query',
    '-H', f'Authorization: Bearer {token}',
    '-H', 'Content-Type: application/json',
    '-d', f'@{tmpfile}',
], capture_output=True, text=True)
os.unlink(tmpfile)
if result.returncode != 0:
    sys.exit(result.stderr)
try:
    print(json.dumps(json.loads(result.stdout), indent=2))
except json.JSONDecodeError:
    sys.exit(f'Réponse inattendue: {result.stdout}')
endef
export PY_SUPABASE_QUERY

.PHONY: deploy db-pull-env db-deploy db-status db-check db-reset

# ── Application ──────────────────────────────────────────────────────────────

deploy:
	npm test
	npm run build:assets
	$(VERCEL) --prod

# ── Base de données ───────────────────────────────────────────────────────────

# Récupère les variables d'environnement Vercel (production) dans .env.local
db-pull-env:
	$(VERCEL) env pull --environment=production .env.local

# Applique le schéma de migration via la Supabase Management API (idempotent)
db-deploy:
	@test -f .env.local || { echo "Lancez d'abord: make db-pull-env"; exit 1; }
	@cat $(MIGRATION) | python3 -c "$$PY_SUPABASE_QUERY"
	@echo "Migration appliquée."

# Affiche les colonnes des tables principales
db-status:
	@test -f .env.local || { echo "Lancez d'abord: make db-pull-env"; exit 1; }
	@printf "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('competitions','combats','judokas') ORDER BY table_name, ordinal_position;" \
	  | python3 -c "$$PY_SUPABASE_QUERY"

# Supprime toutes les données (schéma conservé) — nécessite CONFIRM=yes
db-reset:
	@test -f .env.local || { echo "Lancez d'abord: make db-pull-env"; exit 1; }
	@test "$(CONFIRM)" = "yes" \
	  || { echo "Action destructive. Confirmez avec : make db-reset CONFIRM=yes"; exit 1; }
	@printf "TRUNCATE public.combats, public.competitions, public.club_competitions, public.parent_judokas, public.access_invitations, public.judokas CASCADE;" \
	  | python3 -c "$$PY_SUPABASE_QUERY"
	@echo "Toutes les données ont été supprimées."

# Vérifie la connexion et compte les enregistrements
db-check:
	@test -f .env.local || { echo "Lancez d'abord: make db-pull-env"; exit 1; }
	@printf "SELECT 'judokas' AS tbl, COUNT(*)::int AS lignes FROM public.judokas UNION ALL SELECT 'competitions', COUNT(*)::int FROM public.competitions UNION ALL SELECT 'combats', COUNT(*)::int FROM public.combats;" \
	  | python3 -c "$$PY_SUPABASE_QUERY"
