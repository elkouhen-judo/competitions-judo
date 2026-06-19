const test = require("node:test");
const assert = require("node:assert/strict");

const { createGroqClient } = require("../core/infra/groq-client");

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

test("generateToolChatCompletion sends tool_choice=required and returns the chosen tool call", async () => {
  let capturedBody;
  await withMockedFetch(
    async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return jsonResponse(200, {
        choices: [
          {
            message: {
              content: "",
              tool_calls: [{ function: { name: "mcp_judokas_list", arguments: "{}" } }]
            }
          }
        ]
      });
    },
    async () => {
      const client = createGroqClient({
        getGroqApiKey: () => "key",
        getGroqModel: () => "llama-3.1-8b-instant"
      });
      const completion = await client.generateToolChatCompletion(
        [{ role: "user", content: "liste les judokas" }],
        [
          {
            type: "function",
            function: { name: "mcp_judokas_list", description: "", parameters: {} }
          }
        ]
      );
      assert.equal(completion.toolCalls[0].function.name, "mcp_judokas_list");
    }
  );
  assert.equal(capturedBody.tool_choice, "required");
});

test("generateToolChatCompletion recovers a tool call from a malformed tool_use_failed response", async () => {
  await withMockedFetch(
    async () =>
      jsonResponse(400, {
        error: {
          message:
            "tool call validation failed: attempted to call tool ' mcp_judokas_list' which was not in request.tools",
          type: "invalid_request_error",
          code: "tool_use_failed",
          failed_generation:
            '<function= mcp_judokas_list>{"filters": {"ageCategory": "Minime"}, "limit": 10}</function>'
        }
      }),
    async () => {
      const client = createGroqClient({
        getGroqApiKey: () => "key",
        getGroqModel: () => "llama-3.1-8b-instant"
      });
      const completion = await client.generateToolChatCompletion(
        [{ role: "user", content: "liste les minimes" }],
        []
      );

      assert.equal(completion.toolCalls.length, 1);
      assert.equal(completion.toolCalls[0].function.name, "mcp_judokas_list");
      assert.deepEqual(JSON.parse(completion.toolCalls[0].function.arguments), {
        filters: { ageCategory: "Minime" },
        limit: 10
      });
    }
  );
});

test("generateToolChatCompletion still throws on a Groq error it cannot recover a tool call from", async () => {
  await withMockedFetch(
    async () => jsonResponse(500, { error: { message: "internal error" } }),
    async () => {
      const client = createGroqClient({
        getGroqApiKey: () => "key",
        getGroqModel: () => "llama-3.1-8b-instant"
      });
      await assert.rejects(
        () => client.generateToolChatCompletion([{ role: "user", content: "x" }], []),
        /Erreur Groq 500/
      );
    }
  );
});

test("generateChatCompletion returns the JSON content on success", async () => {
  await withMockedFetch(
    async () => jsonResponse(200, { choices: [{ message: { content: '{"entity":"judokas"}' } }] }),
    async () => {
      const client = createGroqClient({
        getGroqApiKey: () => "key",
        getGroqModel: () => "llama-3.1-8b-instant"
      });
      const content = await client.generateChatCompletion([{ role: "user", content: "x" }]);
      assert.equal(content, '{"entity":"judokas"}');
    }
  );
});

test("requests return empty results without calling the network when no API key is configured", async () => {
  let called = false;
  await withMockedFetch(
    async () => {
      called = true;
      return jsonResponse(200, { choices: [] });
    },
    async () => {
      const client = createGroqClient({
        getGroqApiKey: () => "",
        getGroqModel: () => "llama-3.1-8b-instant"
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
