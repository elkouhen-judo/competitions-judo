const { mcpServerService, verifyMcpToken } = require("./_core");
const { getRuntimeAppUrl } = require("./app.js").__internal;
const { readRawBody } = require("./_read-body");

const PROTOCOL_VERSION = "2025-06-18";
const JSON_RPC_PARSE_ERROR = -32700;
const JSON_RPC_METHOD_NOT_FOUND = -32601;
const JSON_RPC_APPLICATION_ERROR = -32000;

function sendJsonRpcResult(res, id, result) {
  res.status(200).json({ jsonrpc: "2.0", id, result });
}

function sendJsonRpcError(res, id, code, message) {
  res.status(200).json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function isNotification(message) {
  return message && typeof message === "object" && !("id" in message);
}

async function handleInitialize(req, res, message) {
  sendJsonRpcResult(res, message.id, {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: { name: "kiroku-mcp", version: "1.0.0" }
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    const origin = getRuntimeAppUrl(req);
    res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`);
    res.status(401).json({ error: "Token MCP requis." });
    return;
  }

  let claims;
  try {
    claims = verifyMcpToken(token);
  } catch (error) {
    const origin = getRuntimeAppUrl(req);
    res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`);
    res.status(401).json({ error: error.message || "Token MCP invalide." });
    return;
  }

  let message;
  try {
    const raw = await readRawBody(req);
    message = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    sendJsonRpcError(res, null, JSON_RPC_PARSE_ERROR, "Corps JSON invalide.");
    return;
  }

  if (isNotification(message)) {
    res.status(202).end();
    return;
  }

  if (message.method === "initialize") {
    await handleInitialize(req, res, message);
    return;
  }

  try {
    const result = await mcpServerService.handleRequest(claims, message);
    sendJsonRpcResult(res, message.id, result);
  } catch (error) {
    const code = error.message === "Méthode MCP inconnue." ? JSON_RPC_METHOD_NOT_FOUND : JSON_RPC_APPLICATION_ERROR;
    sendJsonRpcError(res, message.id, code, error.message || "Erreur MCP.");
  }
};
