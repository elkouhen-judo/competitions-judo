const { methods, verifySupabaseUser } = require("./_core");
const { runInRequestScope } = require("../core/infra/request-scope.js");

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Requête trop volumineuse."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (_error) {
        reject(new Error("Corps JSON invalide."));
      }
    });
    req.on("error", reject);
  });
}

// MESURE-1 : durée totale, durée d'authentification, nombre de requêtes Supabase et leur
// durée cumulée, dans l'en-tête Server-Timing et dans les journaux Vercel.
function reportTimings(res, methodName, startedAt, authMs, scope, failed) {
  const totalMs = performance.now() - startedAt;
  const round = (value) => Math.round(value * 10) / 10;
  res.setHeader(
    "Server-Timing",
    [
      `total;dur=${round(totalMs)}`,
      `auth;dur=${round(authMs)}`,
      `supabase;dur=${round(scope.supabaseMs)};desc="${scope.requests} req / ${scope.stages} etapes"`
    ].join(", ")
  );
  console.log(
    JSON.stringify({
      rpc: methodName || "inconnue",
      ok: !failed,
      totalMs: round(totalMs),
      authMs: round(authMs),
      supabaseRequests: scope.requests,
      supabaseStages: scope.stages,
      supabaseMs: round(scope.supabaseMs)
    })
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  await runInRequestScope(async (scope) => {
    const startedAt = performance.now();
    let authMs = 0;
    let methodName = "";
    try {
      const authorization = req.headers.authorization || "";
      const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      const bodyPromise = readBody(req);
      const email = await verifySupabaseUser(accessToken);
      authMs = performance.now() - startedAt;
      const body = await bodyPromise;

      if (typeof body.method !== "string" || !Object.hasOwn(methods, body.method)) {
        throw new Error("Méthode inconnue.");
      }

      methodName = body.method;
      const method = methods[body.method];

      const result = await method(email, ...(Array.isArray(body.args) ? body.args : []));
      reportTimings(res, methodName, startedAt, authMs, scope, false);
      res.status(200).json({ result });
    } catch (error) {
      reportTimings(res, methodName, startedAt, authMs, scope, true);
      res.status(400).json({ error: error.message || "Erreur serveur." });
    }
  });
};
