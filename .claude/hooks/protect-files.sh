#!/usr/bin/env bash
# PreToolUse (Write|Edit|MultiEdit) : refuse l'écriture dans les secrets et les fichiers générés.
# - .env*            : secrets, jamais modifiés par l'agent ;
# - assets/app.css   : généré par `npm run build:styles` depuis assets/app.tailwind.css ;
# - assets/dist/     : généré par `npm run build:assets` depuis assets/*.ts ;
# - core-dist/       : généré par `npm run build:core` depuis core/**/*.ts.
set -euo pipefail

file_path="$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')"
[ -z "$file_path" ] && exit 0

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
relative="${file_path#"$project_dir"/}"
name="$(basename "$relative")"

reason=""
case "$name" in
  .env | .env.*) reason="Fichier de secrets : l'agent ne modifie jamais .env*." ;;
esac
case "$relative" in
  assets/app.css) reason="Fichier généré : modifier assets/app.tailwind.css puis lancer npm run build:styles." ;;
  assets/dist/*) reason="Fichier généré : modifier la source assets/*.ts puis lancer npm run build:assets." ;;
  core-dist/*) reason="Fichier généré : modifier la source core/**/*.ts puis lancer npm run build:core." ;;
esac

if [ -n "$reason" ]; then
  jq -n --arg reason "$reason" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'
fi
exit 0
