const { trackSupabaseRequest } = require("./request-scope.js");

function isJwtLikeToken(value) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(String(value || ""));
}

function getResponsePreview(body) {
  return String(body || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function parseJsonBody(body, invalidMessage) {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    const preview = getResponsePreview(body);
    throw new Error(preview ? `${invalidMessage} ${preview}` : invalidMessage, { cause: error });
  }
}

function createSupabaseHeaders(apiKey, options = {}) {
  const headers = {
    apikey: apiKey
  };

  if (options.authorizationToken) {
    headers.Authorization = `Bearer ${options.authorizationToken}`;
  }

  if (options.contentType !== false) {
    headers["Content-Type"] = "application/json";
  }

  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  return headers;
}

function createSupabaseClient({ getSupabaseConfig }) {
  async function supabaseRequest(table, query, options = {}) {
    const config = getSupabaseConfig();
    const method = options.method || "get";
    const requestUrl = `${config.url}/rest/v1/${table}${query ? `?${query}` : ""}`;
    const headers = createSupabaseHeaders(config.serviceRoleKey, {
      authorizationToken: isJwtLikeToken(config.serviceRoleKey) ? config.serviceRoleKey : "",
      prefer: options.prefer
    });

    return trackSupabaseRequest(method, async () => {
      const response = await fetch(requestUrl, {
        method: method.toUpperCase(),
        headers,
        body: Object.prototype.hasOwnProperty.call(options, "payload")
          ? JSON.stringify(options.payload)
          : undefined
      });
      const body = await response.text();

      if (!response.ok) {
        throw new Error(`Erreur Supabase ${response.status} sur ${table} : ${body}`);
      }
      if (options.onResponse) {
        options.onResponse(response);
      }

      return parseJsonBody(body, `Réponse Supabase invalide sur ${table}.`);
    });
  }

  // Une fonction en lecture seule (readOnly) ne vide pas les lectures mémorisées de l'appel.
  async function supabaseRpc(functionName, payload, options = {}) {
    const config = getSupabaseConfig();
    return trackSupabaseRequest(options.readOnly ? "get" : "post", async () => {
      const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
        method: "POST",
        headers: createSupabaseHeaders(config.serviceRoleKey, {
          authorizationToken: isJwtLikeToken(config.serviceRoleKey) ? config.serviceRoleKey : ""
        }),
        body: JSON.stringify(payload || {})
      });
      const body = await response.text();

      if (!response.ok) {
        throw new Error(body || `Erreur Supabase RPC ${functionName}.`);
      }

      return parseJsonBody(body, `Réponse Supabase RPC invalide pour ${functionName}.`);
    });
  }

  return {
    supabaseRequest,
    supabaseRpc
  };
}

module.exports = {
  createSupabaseClient,
  createSupabaseHeaders,
  isJwtLikeToken
};
