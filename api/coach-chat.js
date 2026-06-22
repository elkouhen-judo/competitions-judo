const { methods, verifySupabaseUser } = require("./_core");
const { readRawBody } = require("./_read-body");
const { createUIMessageStream, pipeUIMessageStreamToResponse } = require("ai");

function extractQuestion(body) {
  const lastMessage = Array.isArray(body.messages) ? body.messages.at(-1) : null;
  const parts = (lastMessage && lastMessage.parts) || [];
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
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
    const rawBodyPromise = readRawBody(req);
    const email = await verifySupabaseUser(accessToken);
    const body = JSON.parse((await rawBodyPromise) || "{}");
    const question = extractQuestion(body);

    const { answer, matches } = await methods.askCoachAssistant(email, question);

    const stream = createUIMessageStream({
      execute({ writer }) {
        writer.write({ type: "start" });
        writer.write({ type: "text-start", id: "answer" });
        writer.write({ type: "text-delta", id: "answer", delta: answer });
        writer.write({ type: "text-end", id: "answer" });
        writer.write({ type: "data-coachMatches", data: matches });
        writer.write({ type: "finish" });
      }
    });
    pipeUIMessageStreamToResponse({ response: res, stream });
  } catch (error) {
    res.status(400).json({ error: error.message || "Erreur serveur." });
  }
};
