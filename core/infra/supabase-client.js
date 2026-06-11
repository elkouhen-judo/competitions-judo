function isJwtLikeToken(value) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(String(value || ""));
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

    return body ? JSON.parse(body) : null;
  }

  async function supabaseRpc(functionName, payload) {
    const config = getSupabaseConfig();
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

    return body ? JSON.parse(body) : null;
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
