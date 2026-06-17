const SUPABASE_URL_ENV = "SUPABASE_URL";
const SUPABASE_SERVICE_ROLE_KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY";
const SUPABASE_ANON_KEY_ENV = "SUPABASE_ANON_KEY";
const GROQ_API_KEY_ENV = "GROQ_API_KEY";
const GROQ_MODEL_ENV = "GROQ_MODEL";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

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

// L'analyse IA est une amélioration optionnelle : son absence ne doit jamais empêcher la finalisation d'une compétition.
function getGroqApiKey() {
  return process.env[GROQ_API_KEY_ENV] || "";
}

function getGroqModel() {
  return process.env[GROQ_MODEL_ENV] || DEFAULT_GROQ_MODEL;
}

module.exports = {
  SUPABASE_ANON_KEY_ENV,
  SUPABASE_SERVICE_ROLE_KEY_ENV,
  SUPABASE_URL_ENV,
  GROQ_API_KEY_ENV,
  GROQ_MODEL_ENV,
  getRequiredEnv,
  getSupabaseConfig,
  getGroqApiKey,
  getGroqModel
};
