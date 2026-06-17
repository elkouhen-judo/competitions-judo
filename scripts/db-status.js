const { runSupabaseQuery } = require("./supabase-query");

const sql = `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('competitions','combats','judokas') ORDER BY table_name, ordinal_position;`;

runSupabaseQuery(sql)
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
