#!/usr/bin/env bash
# PostToolUse (Write|Edit|MultiEdit) : lance eslint sur le seul fichier .ts/.js modifié.
# Les erreurs sont renvoyées à l'agent (code 2) pour qu'il les corrige tout de suite.
set -uo pipefail

file_path="$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')"
[ -z "$file_path" ] && exit 0

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
relative="${file_path#"$project_dir"/}"

case "$relative" in
  assets/dist/* | core-dist/* | node_modules/* | assets/vendor/*) exit 0 ;;
  *.ts | *.js | *.mjs | *.cjs) ;;
  *) exit 0 ;;
esac

eslint="$project_dir/node_modules/.bin/eslint"
[ -x "$eslint" ] || exit 0

if ! output="$(cd "$project_dir" && "$eslint" --no-warn-ignored "$relative" 2>&1)"; then
  echo "eslint signale des problèmes dans $relative :" >&2
  echo "$output" >&2
  exit 2
fi
exit 0
