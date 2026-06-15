function normalizeRows(rows) {
  return rows.map((row) => {
    const normalized = {};
    Object.keys(row).forEach((key) => {
      normalized[key] = row[key] === null || row[key] === undefined ? "" : row[key];
    });
    return normalized;
  });
}

function createSupabaseRest({ supabaseRequest }) {
  async function supabaseSelect(table, query) {
    return normalizeRows(
      (await supabaseRequest(table, query || "select=*", { method: "get" })) || []
    );
  }

  async function supabaseSelectOne(table, query) {
    const separator = query ? "&" : "";
    const rows = await supabaseSelect(table, `${query || "select=*"}${separator}limit=1`);
    return rows.length ? rows[0] : null;
  }

  async function supabaseInsert(table, payload) {
    const rows = await supabaseRequest(table, "select=*", {
      method: "post",
      payload,
      prefer: "return=representation"
    });
    return normalizeRows(rows || [])[0] || null;
  }

  async function supabasePatch(table, query, payload) {
    const rows = await supabaseRequest(table, `${query}&select=*`, {
      method: "patch",
      payload,
      prefer: "return=representation"
    });
    return normalizeRows(rows || [])[0] || null;
  }

  async function supabaseDelete(table, query) {
    await supabaseRequest(table, query, {
      method: "delete",
      prefer: "return=minimal"
    });
  }

  return {
    supabaseDelete,
    supabaseInsert,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne
  };
}

module.exports = {
  createSupabaseRest,
  normalizeRows
};
