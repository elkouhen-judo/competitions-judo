const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 1024;

function createAnthropicClient({ getAnthropicApiKey, getAnthropicModel }) {
  async function createMessage(messages, options = {}) {
    const apiKey = getAnthropicApiKey();
    if (!apiKey) {
      return { content: "", toolCalls: [] };
    }

    const system = messages.find((message) => message.role === "system")?.content;
    const conversation = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role, content: message.content }));

    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: getAnthropicModel(),
        max_tokens: MAX_TOKENS,
        temperature: 0,
        ...(system ? { system } : {}),
        messages: conversation,
        ...(options.tools ? { tools: options.tools, tool_choice: { type: "any" } } : {})
      })
    });

    if (!response.ok) {
      const body = await response.text();
      const error = /** @type {Error & { anthropicStatus?: number }} */ (
        new Error(`Erreur Anthropic ${response.status} : ${body}`)
      );
      error.anthropicStatus = response.status;
      throw error;
    }

    const payload = await response.json();
    const blocks = Array.isArray(payload?.content) ? payload.content : [];
    const textBlock = blocks.find((block) => block.type === "text");
    const toolUseBlocks = blocks.filter((block) => block.type === "tool_use");
    return {
      content: String(textBlock?.text || "").trim(),
      toolCalls: toolUseBlocks.map((block) => ({
        id: block.id,
        function: { name: block.name, arguments: JSON.stringify(block.input || {}) }
      }))
    };
  }

  async function generateChatCompletion(messages) {
    const completion = await createMessage(messages);
    return completion.content;
  }

  async function generateToolChatCompletion(messages, tools) {
    return createMessage(messages, { tools });
  }

  return { generateChatCompletion, generateToolChatCompletion };
}

module.exports = { createAnthropicClient };
