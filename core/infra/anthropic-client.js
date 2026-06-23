const { createAnthropic } = require("@ai-sdk/anthropic");
const { generateText, jsonSchema, APICallError } = require("ai");

const MAX_OUTPUT_TOKENS = 1024;

function defaultCreateModel(apiKey, model) {
  return createAnthropic({ apiKey })(model);
}

function toAiSdkTools(tools) {
  return Object.fromEntries(
    tools.map((toolDef) => [
      toolDef.name,
      { description: toolDef.description, inputSchema: jsonSchema(toolDef.input_schema || {}) }
    ])
  );
}

function createAnthropicClient({ getAnthropicApiKey, getAnthropicModel, createModel = defaultCreateModel }) {
  async function createMessage(messages, options = {}) {
    const apiKey = getAnthropicApiKey();
    if (!apiKey) {
      return { content: "", toolCalls: [] };
    }

    const system = messages.find((message) => message.role === "system")?.content;
    const conversation = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role, content: message.content }));

    let result;
    try {
      result = await generateText({
        model: createModel(apiKey, getAnthropicModel()),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        maxRetries: 0,
        temperature: 0,
        ...(system ? { system } : {}),
        messages: conversation,
        ...(options.tools ? { tools: toAiSdkTools(options.tools), toolChoice: "required" } : {})
      });
    } catch (error) {
      if (APICallError.isInstance(error)) {
        const wrapped = /** @type {Error & { anthropicStatus?: number }} */ (
          new Error(`Erreur Anthropic ${error.statusCode} : ${error.responseBody || error.message}`)
        );
        wrapped.anthropicStatus = error.statusCode;
        throw wrapped;
      }
      throw error;
    }

    return {
      content: String(result.text || "").trim(),
      toolCalls: result.toolCalls.map((call) => ({
        id: call.toolCallId,
        function: { name: call.toolName, arguments: JSON.stringify(call.input || {}) }
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
