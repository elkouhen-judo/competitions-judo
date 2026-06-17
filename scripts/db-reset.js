const { runSupabaseQuery } = require("./supabase-query");

const sql = `TRUNCATE public.combats, public.competitions, public.club_competitions, public.parent_judokas, public.access_invitations, public.judokas CASCADE;`;

const confirmed = process.env.CONFIRM === "yes" || process.argv.includes("--yes");
if (!confirmed) {
  console.error("Action destructive. Confirmez avec : CONFIRM=yes npm run db:reset");
  process.exit(1);
}

runSupabaseQuery(sql)
  .then(() => console.log("Toutes les données ont été supprimées."))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
