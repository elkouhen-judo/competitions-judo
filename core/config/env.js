const SUPABASE_URL_ENV = "SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY";
const SUPABASE_ANON_KEY_ENV = "SUPABASE_ANON_KEY";
const GROQ_API_KEY_ENV = "GROQ_API_KEY";
const GROQ_MODEL_ENV = "GROQ_MODEL";
const MCP_JWT_SECRET_ENV = "MCP_JWT_SECRET";
const MCP_TOKEN_TTL_SECONDS_ENV = "MCP_TOKEN_TTL_SECONDS";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";
const DEFAULT_MCP_TOKEN_TTL_SECONDS = 900;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Configuration manquante : ${name} est obligatoire.`);
  }
  return value;
}

function getSupabaseConfig() {
  return {
    url: getRequiredEnv(SUPABASE_URL_ENV).replace(/\/$/, ""),
    serviceRoleKey: getRequiredEnv(SUPABASE_SERVICE_ROLE_KEY_ENV),
    anonKey: getRequiredEnv(SUPABASE_ANON_KEY_ENV)
  };
}

function getGroqApiKey() {
  return String(process.env[GROQ_API_KEY_ENV] || "").trim();
}

function getGroqModel() {
  return String(process.env[GROQ_MODEL_ENV] || DEFAULT_GROQ_MODEL).trim();
}

function getMcpJwtSecret() {
  return String(process.env[MCP_JWT_SECRET_ENV] || "").trim();
}

function getMcpTokenTtlSeconds() {
  const raw = Number(process.env[MCP_TOKEN_TTL_SECONDS_ENV] || DEFAULT_MCP_TOKEN_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MCP_TOKEN_TTL_SECONDS;
}

module.exports = {
  SUPABASE_ANON_KEY_ENV,
  SUPABASE_SERVICE_ROLE_KEY_ENV,
  SUPABASE_URL_ENV,
  GROQ_API_KEY_ENV,
  GROQ_MODEL_ENV,
  MCP_JWT_SECRET_ENV,
  MCP_TOKEN_TTL_SECONDS_ENV,
  getRequiredEnv,
  getSupabaseConfig,
  getGroqApiKey,
  getGroqModel,
  getMcpJwtSecret,
  getMcpTokenTtlSeconds
};
