const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

function createGroqClient({ getGroqApiKey, getGroqModel }) {
  async function generateChatCompletion(messages) {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return "";
    }

    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: getGroqModel(),
        messages,
        temperature: 0,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Erreur Groq ${response.status} : ${body}`);
    }

    const payload = await response.json();
    return String(payload?.choices?.[0]?.message?.content || "").trim();
  }

  return { generateChatCompletion };
}

module.exports = { createGroqClient };
