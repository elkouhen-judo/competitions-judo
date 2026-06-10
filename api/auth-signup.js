const { createConfirmedAuthUser } = require("./_core");

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 16 * 1024) {
        reject(new Error("Requête trop volumineuse."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body ? JSON.parse(body) : {}));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  try {
    const body = await readBody(req);
    const result = await createConfirmedAuthUser(body.email, body.password);
    res.status(200).json({
      ok: true,
      requiresEmailConfirmation: Boolean(result && result.requiresEmailConfirmation)
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "Création du compte impossible." });
  }
};
