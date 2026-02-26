/**
 * Lightweight MCP (Model Context Protocol) client for the Elastic Docs server.
 *
 * Communicates with the Streamable HTTP endpoint at
 * `https://www.elastic.co/docs/_mcp/` using JSON-RPC 2.0 over HTTP POST.
 *
 * The client discovers available tools at runtime, caches them, and converts
 * them into Vercel AI SDK `tool()` definitions so they can be passed directly
 * to `generateText` / `streamText`.
 */

import { tool, jsonSchema } from "ai";
import type { ToolSet } from "ai";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const ELASTIC_DOCS_MCP_URL = "https://www.elastic.co/docs/_mcp/";

const PROTOCOL_VERSION = "2025-03-26";

const CLIENT_INFO = {
  name: "elastic-peek",
  version: "0.1.0",
} as const;

/* ------------------------------------------------------------------ */
/*  JSON-RPC types                                                     */
/* ------------------------------------------------------------------ */

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/* ------------------------------------------------------------------ */
/*  MCP tool schema types                                              */
/* ------------------------------------------------------------------ */

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Session state                                                      */
/* ------------------------------------------------------------------ */

let sessionId: string | undefined;
let cachedTools: McpToolDefinition[] | undefined;

/* ------------------------------------------------------------------ */
/*  Transport helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Send a JSON-RPC message to the MCP server and return the parsed response.
 * Notifications (no `id`) are sent as fire-and-forget.
 */
async function rpc(
  message: JsonRpcRequest,
  signal?: AbortSignal,
): Promise<JsonRpcResponse | undefined> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sessionId) {
    headers["Mcp-Session-Id"] = sessionId;
  }

  const res = await fetch(ELASTIC_DOCS_MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
    signal,
  });

  // Capture the session id returned by the server.
  const sid = res.headers.get("Mcp-Session-Id");
  if (sid) {
    sessionId = sid;
  }

  // Notifications have no id and expect no meaningful response body.
  if (message.id === undefined) return undefined;

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("text/event-stream")) {
    // The Streamable HTTP transport may return SSE for request/response.
    // We consume all `message` events and return the last JSON-RPC result.
    const text = await res.text();
    let last: JsonRpcResponse | undefined;
    for (const chunk of text.split("\n")) {
      const trimmed = chunk.trim();
      if (trimmed.startsWith("data:")) {
        try {
          last = JSON.parse(trimmed.slice(5).trim()) as JsonRpcResponse;
        } catch {
          /* skip non-JSON lines */
        }
      }
    }
    if (!last) throw new Error("Empty SSE response from MCP server");
    return last;
  }

  return (await res.json()) as JsonRpcResponse;
}

/* ------------------------------------------------------------------ */
/*  Session lifecycle                                                  */
/* ------------------------------------------------------------------ */

let nextId = 1;

function nextRequestId(): number {
  return nextId++;
}

/**
 * Perform the MCP `initialize` handshake followed by the `initialized`
 * notification.  Must be called before any other method.
 */
async function initialize(signal?: AbortSignal): Promise<void> {
  const initRes = await rpc(
    {
      jsonrpc: "2.0",
      id: nextRequestId(),
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: CLIENT_INFO,
      },
    },
    signal,
  );

  if (initRes?.error) {
    throw new Error(`MCP initialize failed: ${initRes.error.message}`);
  }

  // Fire-and-forget the initialized notification.
  await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, signal);
}

/* ------------------------------------------------------------------ */
/*  Tool discovery                                                     */
/* ------------------------------------------------------------------ */

/**
 * Fetch the list of tools exposed by the MCP server.
 * The result is cached for the lifetime of the session.
 */
async function listTools(signal?: AbortSignal): Promise<McpToolDefinition[]> {
  if (cachedTools) return cachedTools;

  await initialize(signal);

  const res = await rpc(
    {
      jsonrpc: "2.0",
      id: nextRequestId(),
      method: "tools/list",
      params: {},
    },
    signal,
  );

  if (res?.error) {
    throw new Error(`MCP tools/list failed: ${res.error.message}`);
  }

  const result = res?.result as { tools?: McpToolDefinition[] } | undefined;
  cachedTools = result?.tools ?? [];
  return cachedTools;
}

/* ------------------------------------------------------------------ */
/*  Tool execution                                                     */
/* ------------------------------------------------------------------ */

/**
 * Invoke an MCP tool by name with the given arguments and return the
 * result content.
 */
async function callTool(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  const res = await rpc(
    {
      jsonrpc: "2.0",
      id: nextRequestId(),
      method: "tools/call",
      params: { name, arguments: args },
    },
    signal,
  );

  if (res?.error) {
    throw new Error(`MCP tools/call "${name}" failed: ${res.error.message}`);
  }

  return res?.result;
}

/* ------------------------------------------------------------------ */
/*  AI SDK integration                                                 */
/* ------------------------------------------------------------------ */

/**
 * Convert MCP tool definitions into a Vercel AI SDK `ToolSet`.
 *
 * Each MCP tool becomes an AI SDK `tool()` whose `execute` function
 * delegates to `callTool`, forwarding the call over HTTP to the MCP server.
 */
function convertToAiTools(mcpTools: McpToolDefinition[], signal?: AbortSignal): ToolSet {
  const tools: ToolSet = {};
  for (const t of mcpTools) {
    const schema = jsonSchema<Record<string, unknown>>(
      t.inputSchema as Parameters<typeof jsonSchema>[0],
    );
    tools[t.name] = tool<Record<string, unknown>, unknown>({
      description: t.description ?? t.name,
      inputSchema: schema,
      execute: async (args) => callTool(t.name, args, signal),
    });
  }
  return tools;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Fetch the Elastic Docs MCP tools and return them as an AI SDK `ToolSet`
 * ready to be passed to `generateText` / `streamText`.
 *
 * The underlying MCP session is initialised lazily on the first call and
 * tool definitions are cached for subsequent invocations.
 */
export async function getElasticDocsTools(signal?: AbortSignal): Promise<ToolSet> {
  const mcpTools = await listTools(signal);
  return convertToAiTools(mcpTools, signal);
}

/**
 * Reset the cached MCP session so the next call to `getElasticDocsTools`
 * re-initialises from scratch.
 */
export function resetMcpSession(): void {
  sessionId = undefined;
  cachedTools = undefined;
  nextId = 1;
}
