const { AsyncLocalStorage } = require("node:async_hooks");

// Portée d'un appel (RPC ou MCP) : compteurs de requêtes Supabase et lectures mémorisées.
const storage = new AsyncLocalStorage();

function runInRequestScope(callback) {
  const scope = { requests: 0, stages: 0, inFlight: 0, supabaseMs: 0, memo: new Map() };
  return storage.run(scope, () => callback(scope));
}

// Une « étape » est un groupe de requêtes lancées en parallèle : elle commence
// quand une requête part alors qu'aucune autre n'est en cours.
async function trackSupabaseRequest(method, send) {
  const scope = storage.getStore();
  if (!scope) {
    return send();
  }

  const isWrite = String(method || "get").toLowerCase() !== "get";
  if (isWrite) {
    scope.memo.clear();
  }
  if (scope.inFlight === 0) {
    scope.stages += 1;
  }
  scope.inFlight += 1;
  scope.requests += 1;
  const startedAt = performance.now();
  try {
    return await send();
  } finally {
    scope.inFlight -= 1;
    scope.supabaseMs += performance.now() - startedAt;
    if (isWrite) {
      scope.memo.clear();
    }
  }
}

// Mémorise une lecture pour la durée de l'appel ; toute écriture Supabase vide la mémoire.
function memoizeInRequest(key, load) {
  const scope = storage.getStore();
  if (!scope) {
    return load();
  }
  if (!scope.memo.has(key)) {
    const pending = Promise.resolve().then(load);
    scope.memo.set(key, pending);
    pending.catch(() => {
      if (scope.memo.get(key) === pending) {
        scope.memo.delete(key);
      }
    });
  }
  return scope.memo.get(key);
}

module.exports = {
  memoizeInRequest,
  runInRequestScope,
  trackSupabaseRequest
};
