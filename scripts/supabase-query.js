const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const envLocalPath = path.join(root, ".env.local");

function loadEnvLocal() {
  if (!fs.existsSync(envLocalPath)) {
    throw new Error("Fichier .env.local introuvable — lancez : npm run db:pull-env");
  }

  const env = {};
  for (const line of fs.readFileSync(envLocalPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...rest] = trimmed.split("=");
    env[key] = rest.join("=").trim().replace(/^"(.*)"$/, "$1");
  }
  return env;
}

function getProjectRef(env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ref = url.replace("https://", "").split(".")[0];
  if (!ref) {
    throw new Error(
      "SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL introuvable dans .env.local — lancez : npm run db:pull-env"
    );
  }
  return ref;
}

function getAccessToken(env) {
  const token = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN non défini.\nCréez un token sur : supabase.com/dashboard/account/tokens"
    );
  }
  return token;
}

async function runSupabaseQuery(sql) {
  const env = loadEnvLocal();
  const ref = getProjectRef(env);
  const token = getAccessToken(env);

  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query: sql })
  });

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Réponse inattendue: ${text}`);
  }
}

module.exports = { runSupabaseQuery };
