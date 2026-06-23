const test = require("node:test");
const assert = require("node:assert/strict");
const { MockLanguageModelV3 } = require("ai/test");
const { APICallError } = require("ai");

const { createAnthropicClient } = require("../core/infra/anthropic-client");

function createTestClient(doGenerate) {
  const model = new MockLanguageModelV3({ doGenerate });
  return createAnthropicClient({
    getAnthropicApiKey: () => "key",
    getAnthropicModel: () => "claude-haiku-4-5-20251001",
    createModel: () => model
  });
}

function textResult(text) {
  return {
    content: [{ type: "text", text }],
    finishReason: { unified: "stop", raw: undefined },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 10, text: 10, reasoning: undefined }
    },
    warnings: []
  };
}

test("generateToolChatCompletion forces toolChoice=required and returns the chosen tool call", async () => {
  let capturedOptions;
  const client = createTestClient(async (options) => {
    capturedOptions = options;
    return {
      content: [
        { type: "tool-call", toolCallId: "toolu_1", toolName: "mcp_judokas_list", input: "{}" }
      ],
      finishReason: { unified: "tool-calls", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 10, text: 10, reasoning: undefined }
      },
      warnings: []
    };
  });

  const completion = await client.generateToolChatCompletion(
    [{ role: "user", content: "liste les judokas" }],
    [{ name: "mcp_judokas_list", description: "", input_schema: {} }]
  );

  assert.equal(completion.toolCalls[0].function.name, "mcp_judokas_list");
  assert.deepEqual(capturedOptions.toolChoice, { type: "required" });
});

test("generateToolChatCompletion throws with the Anthropic status on a non-2xx response", async () => {
  const client = createTestClient(async () => {
    throw new APICallError({
      message: "internal error",
      url: "https://api.anthropic.com/v1/messages",
      requestBodyValues: {},
      statusCode: 500,
      responseBody: "internal error"
    });
  });

  await assert.rejects(
    () => client.generateToolChatCompletion([{ role: "user", content: "x" }], []),
    /Erreur Anthropic 500/
  );
});

test("generateChatCompletion returns the JSON content on success", async () => {
  const client = createTestClient(async () => textResult('{"entity":"judokas"}'));
  const content = await client.generateChatCompletion([{ role: "user", content: "x" }]);
  assert.equal(content, '{"entity":"judokas"}');
});

test("generateChatCompletion extracts the system message into the top-level system field", async () => {
  let capturedOptions;
  const client = createTestClient(async (options) => {
    capturedOptions = options;
    return textResult("");
  });

  await client.generateChatCompletion([
    { role: "system", content: "Tu es un assistant." },
    { role: "user", content: "x" }
  ]);

  assert.equal(capturedOptions.prompt[0].role, "system");
  assert.equal(capturedOptions.prompt[0].content, "Tu es un assistant.");
});

test("requests return empty results without calling the model when no API key is configured", async () => {
  let called = false;
  const client = createAnthropicClient({
    getAnthropicApiKey: () => "",
    getAnthropicModel: () => "claude-haiku-4-5-20251001",
    createModel: () => {
      called = true;
      return new MockLanguageModelV3({ doGenerate: async () => textResult("") });
    }
  });

  const content = await client.generateChatCompletion([{ role: "user", content: "x" }]);
  const completion = await client.generateToolChatCompletion([{ role: "user", content: "x" }], []);

  assert.equal(content, "");
  assert.deepEqual(completion, { content: "", toolCalls: [] });
  assert.equal(called, false);
});
