const { methods, verifySupabaseUser } = require("./_core");

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
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
    const authorization = req.headers.authorization || "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const email = await verifySupabaseUser(accessToken);
    const body = await readBody(req);
    const method = methods[body.method];

    if (!method) {
      throw new Error("Méthode inconnue.");
    }

    const result = await method(email, ...(Array.isArray(body.args) ? body.args : []));
    res.status(200).json({ result });
  } catch (error) {
    res.status(400).json({ error: error.message || "Erreur serveur." });
  }
};
