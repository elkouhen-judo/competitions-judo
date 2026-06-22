const test = require("node:test");
const assert = require("node:assert/strict");

const { createAnthropicClient } = require("../core/infra/anthropic-client");

function withMockedFetch(handler, run) {
  const originalFetch = global.fetch;
  global.fetch = handler;
  return run().finally(() => {
    global.fetch = originalFetch;
  });
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body
  };
}

test("generateToolChatCompletion forces tool_choice=any and returns the chosen tool call", async () => {
  let capturedBody;
  await withMockedFetch(
    async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return jsonResponse(200, {
        content: [{ type: "tool_use", id: "toolu_1", name: "mcp_judokas_list", input: {} }]
      });
    },
    async () => {
      const client = createAnthropicClient({
        getAnthropicApiKey: () => "key",
        getAnthropicModel: () => "claude-haiku-4-5-20251001"
      });
      const completion = await client.generateToolChatCompletion(
        [{ role: "user", content: "liste les judokas" }],
        [{ name: "mcp_judokas_list", description: "", input_schema: {} }]
      );
      assert.equal(completion.toolCalls[0].function.name, "mcp_judokas_list");
    }
  );
  assert.deepEqual(capturedBody.tool_choice, { type: "any" });
});

test("generateToolChatCompletion throws with the Anthropic status on a non-2xx response", async () => {
  await withMockedFetch(
    async () => jsonResponse(500, { error: { message: "internal error" } }),
    async () => {
      const client = createAnthropicClient({
        getAnthropicApiKey: () => "key",
        getAnthropicModel: () => "claude-haiku-4-5-20251001"
      });
      await assert.rejects(
        () => client.generateToolChatCompletion([{ role: "user", content: "x" }], []),
        /Erreur Anthropic 500/
      );
    }
  );
});

test("generateChatCompletion returns the JSON content on success", async () => {
  await withMockedFetch(
    async () => jsonResponse(200, { content: [{ type: "text", text: '{"entity":"judokas"}' }] }),
    async () => {
      const client = createAnthropicClient({
        getAnthropicApiKey: () => "key",
        getAnthropicModel: () => "claude-haiku-4-5-20251001"
      });
      const content = await client.generateChatCompletion([{ role: "user", content: "x" }]);
      assert.equal(content, '{"entity":"judokas"}');
    }
  );
});

test("generateChatCompletion extracts the system message into the top-level system field", async () => {
  let capturedBody;
  await withMockedFetch(
    async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return jsonResponse(200, { content: [{ type: "text", text: "" }] });
    },
    async () => {
      const client = createAnthropicClient({
        getAnthropicApiKey: () => "key",
        getAnthropicModel: () => "claude-haiku-4-5-20251001"
      });
      await client.generateChatCompletion([
        { role: "system", content: "Tu es un assistant." },
        { role: "user", content: "x" }
      ]);
    }
  );
  assert.equal(capturedBody.system, "Tu es un assistant.");
  assert.deepEqual(capturedBody.messages, [{ role: "user", content: "x" }]);
});

test("requests return empty results without calling the network when no API key is configured", async () => {
  let called = false;
  await withMockedFetch(
    async () => {
      called = true;
      return jsonResponse(200, { content: [] });
    },
    async () => {
      const client = createAnthropicClient({
        getAnthropicApiKey: () => "",
        getAnthropicModel: () => "claude-haiku-4-5-20251001"
      });
      const content = await client.generateChatCompletion([{ role: "user", content: "x" }]);
      const completion = await client.generateToolChatCompletion(
        [{ role: "user", content: "x" }],
        []
      );
      assert.equal(content, "");
      assert.deepEqual(completion, { content: "", toolCalls: [] });
    }
  );
  assert.equal(called, false);
});
