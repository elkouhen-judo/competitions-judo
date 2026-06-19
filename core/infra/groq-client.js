const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const FAILED_TOOL_CALL_PATTERN = /<function=\s*([^>]+?)\s*>([\s\S]*?)<\/function>/;

/**
 * llama-3.1-8b-instant occasionally emits a malformed tool tag (e.g. a stray leading
 * space in the function name), which Groq rejects with a 400 "tool_use_failed" error
 * instead of a normal tool_calls response. The intended call is still present, verbatim,
 * in error.failed_generation, so we recover it instead of discarding a otherwise-valid answer.
 */
function recoverToolCallFromFailedGeneration(rawBody) {
  let parsedBody;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const error = parsedBody?.error;
  if (!error || error.code !== "tool_use_failed" || typeof error.failed_generation !== "string") {
    return null;
  }
  const match = FAILED_TOOL_CALL_PATTERN.exec(error.failed_generation);
  if (!match) {
    return null;
  }
  return {
    type: "function",
    function: { name: match[1].trim(), arguments: match[2].trim() }
  };
}

function createGroqClient({ getGroqApiKey, getGroqModel }) {
  async function createChatCompletion(messages, options = {}) {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return { content: "", toolCalls: [] };
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
        ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
        ...(options.tools ? { tools: options.tools } : {}),
        ...(options.toolChoice ? { tool_choice: options.toolChoice } : {})
      })
    });

    if (!response.ok) {
      const body = await response.text();
      const recoveredToolCall = recoverToolCallFromFailedGeneration(body);
      if (recoveredToolCall) {
        return { content: "", toolCalls: [recoveredToolCall] };
      }
      const error = /** @type {Error & { groqStatus?: number }} */ (
        new Error(`Erreur Groq ${response.status} : ${body}`)
      );
      error.groqStatus = response.status;
      throw error;
    }

    const payload = await response.json();
    const message = payload?.choices?.[0]?.message || {};
    return {
      content: String(message.content || "").trim(),
      toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : []
    };
  }

  async function generateChatCompletion(messages) {
    const completion = await createChatCompletion(messages, {
      responseFormat: { type: "json_object" }
    });
    return completion.content;
  }

  async function generateToolChatCompletion(messages, tools) {
    return createChatCompletion(messages, {
      tools,
      toolChoice: "required",
      responseFormat: undefined
    });
  }

  return { generateChatCompletion, generateToolChatCompletion };
}

module.exports = { createGroqClient };
