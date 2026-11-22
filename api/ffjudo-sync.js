const crypto = require("node:crypto");

// Agenda FFJDA : déclenché une fois par jour par Vercel Cron (vercel.json), qui envoie
// « Authorization: Bearer <CRON_SECRET> ». Toute autre requête est refusée.
function hasValidSecret(authorization, secret) {
  if (!secret) {
    return false;
  }
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(String(authorization || ""));
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function createFfjudoSyncHandler({ getCronSecret, runSync }) {
  return async function ffjudoSyncHandler(req, res) {
    if (!hasValidSecret(req.headers.authorization, getCronSecret())) {
      res.status(401).json({ error: "Non autorisé." });
      return;
    }
    try {
      const report = await runSync();
      console.log(
        JSON.stringify({
          ffjudoSync: report.status,
          events: report.eventCount,
          sources: report.sources
        })
      );
      res.status(report.status === "error" ? 500 : 200).json(report);
    } catch (error) {
      console.error(JSON.stringify({ ffjudoSync: "exception", error: error.message }));
      res.status(500).json({ error: error.message || "Erreur serveur." });
    }
  };
}

module.exports = createFfjudoSyncHandler({
  getCronSecret: () => require("./_core").getCronSecret(),
  runSync: () => require("./_core").ffjudoSyncService.runSync()
});
module.exports.createFfjudoSyncHandler = createFfjudoSyncHandler;
