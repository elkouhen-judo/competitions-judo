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
        temperature: 0.4,
        max_tokens: 700
      })
    });
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`Erreur Groq ${response.status} : ${body}`);
    }

    const data = JSON.parse(body);
    return data?.choices?.[0]?.message?.content || "";
  }

  return {
    generateChatCompletion
  };
}

module.exports = {
  createGroqClient
};
