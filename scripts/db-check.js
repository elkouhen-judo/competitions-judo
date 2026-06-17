const { runSupabaseQuery } = require("./supabase-query");

const sql = `SELECT 'judokas' AS tbl, COUNT(*)::int AS lignes FROM public.judokas UNION ALL SELECT 'competitions', COUNT(*)::int FROM public.competitions UNION ALL SELECT 'combats', COUNT(*)::int FROM public.combats;`;

runSupabaseQuery(sql)
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
