const { methods, verifySupabaseUser } = require("./_core");
const { readRawBody } = require("./_read-body");
const { createUIMessageStream, pipeUIMessageStreamToResponse } = require("ai");

const MAX_HISTORY_MESSAGES = 6;

function extractMessageText(message) {
  const parts = (message && message.parts) || [];
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}

function extractQuestion(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  return extractMessageText(messages.at(-1));
}

function extractHistory(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  return messages
    .slice(0, -1)
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({ role: message.role, text: extractMessageText(message) }))
    .filter((message) => message.text)
    .slice(-MAX_HISTORY_MESSAGES);
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
    const history = extractHistory(body);

    const { answer, matches } = await methods.askCoachAssistant(email, question, history);

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
