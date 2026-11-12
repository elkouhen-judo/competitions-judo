// Borne explicite de toute lecture de liste. Une liste plus longue est lue page par page.
const LIST_PAGE_SIZE = 1000;

function normalizeRows(rows) {
  return rows.map((row) => {
    const normalized = {};
    Object.keys(row).forEach((key) => {
      normalized[key] = row[key] === null || row[key] === undefined ? "" : row[key];
    });
    return normalized;
  });
}

// En-tête PostgREST « 0-999/1500 » : renvoie 1500, ou null si le total est absent.
function parseContentRangeTotal(contentRange) {
  const match = /\/(\d+)$/.exec(String(contentRange || ""));
  return match ? Number(match[1]) : null;
}

function createSupabaseRest({ supabaseRequest }) {
  async function readPage(table, query, limit, offset) {
    let total = null;
    const rows =
      (await supabaseRequest(table, `${query}&limit=${limit}&offset=${offset}`, {
        method: "get",
        prefer: "count=exact",
        onResponse: (response) => {
          total = parseContentRangeTotal(response.headers.get("content-range"));
        }
      })) || [];
    return { rows, total };
  }

  function assertStableOrder(table, query) {
    if (!/(^|&)order=/.test(query)) {
      throw new Error(
        `Liste trop longue sur ${table} : un tri stable est requis pour lire la suite.`
      );
    }
  }

  // Lit une liste en entier. Si la réponse atteint la borne (ou le plafond du projet
  // Supabase), les pages suivantes sont lues ; une liste n'est jamais tronquée en silence.
  async function supabaseSelect(table, query) {
    const baseQuery = query || "select=*";
    const first = await readPage(table, baseQuery, LIST_PAGE_SIZE, 0);
    const rows = [...first.rows];

    if (first.total === null) {
      let lastPageLength = first.rows.length;
      while (lastPageLength >= LIST_PAGE_SIZE) {
        assertStableOrder(table, baseQuery);
        const next = await readPage(table, baseQuery, LIST_PAGE_SIZE, rows.length);
        rows.push(...next.rows);
        lastPageLength = next.rows.length;
      }
      return normalizeRows(rows);
    }

    if (rows.length < first.total) {
      assertStableOrder(table, baseQuery);
      const pageLength = rows.length;
      if (!pageLength) {
        throw new Error(`Liste incomplète sur ${table} : 0 ligne lue sur ${first.total}.`);
      }
      const offsets = [];
      for (let offset = pageLength; offset < first.total; offset += pageLength) {
        offsets.push(offset);
      }
      const pages = await Promise.all(
        offsets.map((offset) => readPage(table, baseQuery, pageLength, offset))
      );
      pages.forEach((page) => rows.push(...page.rows));
      if (rows.length < first.total) {
        throw new Error(
          `Liste incomplète sur ${table} : ${rows.length} lignes lues sur ${first.total}.`
        );
      }
    }

    return normalizeRows(rows);
  }

  // Lit une seule page et le nombre total de lignes qui répondent au filtre.
  async function supabaseSelectPage(table, query, limit) {
    const page = await readPage(table, query || "select=*", limit, 0);
    return {
      rows: normalizeRows(page.rows),
      total: page.total === null ? page.rows.length : page.total
    };
  }

  async function supabaseSelectOne(table, query) {
    const separator = query ? "&" : "";
    const rows = normalizeRows(
      (await supabaseRequest(table, `${query || "select=*"}${separator}limit=1`, {
        method: "get"
      })) || []
    );
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

  // Insère plusieurs lignes en un seul envoi (tableau JSON).
  async function supabaseInsertMany(table, payloads) {
    if (!payloads.length) {
      return [];
    }
    const rows = await supabaseRequest(table, "select=*", {
      method: "post",
      payload: payloads,
      prefer: "return=representation"
    });
    return normalizeRows(rows || []);
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
    supabaseInsertMany,
    supabasePatch,
    supabaseSelect,
    supabaseSelectOne,
    supabaseSelectPage
  };
}

module.exports = {
  LIST_PAGE_SIZE,
  createSupabaseRest,
  normalizeRows
};
