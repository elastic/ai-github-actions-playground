import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  getElasticDocsTools,
  resetMcpSession,
  ELASTIC_DOCS_MCP_URL,
} from "../../src/services/elasticDocsMcp";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let fetchCalls: Array<{ url: string; init: RequestInit }> = [];
let fetchResponses: Array<{
  headers?: Record<string, string>;
  body: unknown;
}> = [];

function enqueueFetchResponse(body: unknown, headers?: Record<string, string>) {
  fetchResponses.push({ body, headers });
}

/** Simulate the three-call MCP handshake: initialize → initialized → tools/list */
function enqueueHandshakeAndToolList(tools: unknown[]) {
  // 1) initialize response
  enqueueFetchResponse(
    {
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: "elastic-docs", version: "1.0.0" },
      },
    },
    { "mcp-session-id": "test-session-1" },
  );

  // 2) initialized notification — no meaningful body expected
  enqueueFetchResponse({ jsonrpc: "2.0" });

  // 3) tools/list response
  enqueueFetchResponse({
    jsonrpc: "2.0",
    id: 2,
    result: { tools },
  });
}

beforeEach(() => {
  fetchCalls = [];
  fetchResponses = [];
  resetMcpSession();

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      fetchCalls.push({ url, init });
      const next = fetchResponses.shift();
      if (!next) throw new Error("No more fetch responses enqueued");
      const headers = new Headers(next.headers ?? {});
      headers.set("content-type", "application/json");
      return new Response(JSON.stringify(next.body), {
        status: 200,
        headers,
      });
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("elasticDocsMcp", () => {
  it("initializes an MCP session and returns AI SDK tools", async () => {
    enqueueHandshakeAndToolList([
      {
        name: "SemanticSearch",
        description: "Searches all published Elastic documentation by meaning.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query" },
          },
          required: ["query"],
        },
      },
    ]);

    const tools = await getElasticDocsTools();

    // Should have made 3 fetch calls: initialize, initialized, tools/list
    expect(fetchCalls).toHaveLength(3);
    expect(fetchCalls.every((c) => c.url === ELASTIC_DOCS_MCP_URL)).toBe(true);

    // Verify JSON-RPC methods
    const methods = fetchCalls.map((c) => JSON.parse(c.init.body as string).method);
    expect(methods).toEqual(["initialize", "notifications/initialized", "tools/list"]);

    // Verify session id is sent after initialize
    const thirdHeaders = JSON.parse(JSON.stringify(fetchCalls[2].init.headers));
    expect(thirdHeaders["Mcp-Session-Id"]).toBe("test-session-1");

    // Should return a ToolSet with the SemanticSearch tool
    expect(tools).toHaveProperty("SemanticSearch");
    expect(typeof tools.SemanticSearch).toBe("object");
  });

  it("caches tools on subsequent calls without re-initializing", async () => {
    enqueueHandshakeAndToolList([
      {
        name: "SemanticSearch",
        description: "Search docs",
        inputSchema: { type: "object", properties: {} },
      },
    ]);

    const first = await getElasticDocsTools();
    const second = await getElasticDocsTools();

    expect(fetchCalls).toHaveLength(3); // only the first call triggers fetch
    expect(Object.keys(first)).toEqual(Object.keys(second));
  });

  it("re-initializes after resetMcpSession()", async () => {
    enqueueHandshakeAndToolList([
      {
        name: "SemanticSearch",
        description: "Search docs",
        inputSchema: { type: "object", properties: {} },
      },
    ]);

    await getElasticDocsTools();
    expect(fetchCalls).toHaveLength(3);

    resetMcpSession();

    enqueueHandshakeAndToolList([
      {
        name: "SemanticSearch",
        description: "Search docs",
        inputSchema: { type: "object", properties: {} },
      },
    ]);

    await getElasticDocsTools();
    expect(fetchCalls).toHaveLength(6); // 3 + 3
  });

  it("returns empty ToolSet when server has no tools", async () => {
    enqueueHandshakeAndToolList([]);

    const tools = await getElasticDocsTools();
    expect(Object.keys(tools)).toHaveLength(0);
  });

  it("throws when initialize fails with an error", async () => {
    enqueueFetchResponse({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32600, message: "Invalid protocol version" },
    });

    await expect(getElasticDocsTools()).rejects.toThrow("MCP initialize failed");
  });

  it("throws when tools/list fails with an error", async () => {
    // successful initialize + initialized
    enqueueFetchResponse(
      {
        jsonrpc: "2.0",
        id: 1,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          serverInfo: { name: "test", version: "1.0.0" },
        },
      },
      { "mcp-session-id": "s1" },
    );
    enqueueFetchResponse({ jsonrpc: "2.0" });

    // tools/list error
    enqueueFetchResponse({
      jsonrpc: "2.0",
      id: 2,
      error: { code: -32601, message: "Method not found" },
    });

    await expect(getElasticDocsTools()).rejects.toThrow("MCP tools/list failed");
  });

  it("handles SSE response format from the MCP server", async () => {
    // Override fetch for this test to return SSE
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        fetchCalls.push({ url: _url, init });
        const body = JSON.parse(init.body as string);

        if (body.method === "initialize") {
          return new Response(
            `data: ${JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              result: {
                protocolVersion: "2025-03-26",
                capabilities: {},
                serverInfo: { name: "test", version: "1.0.0" },
              },
            })}\n\n`,
            {
              status: 200,
              headers: {
                "content-type": "text/event-stream",
                "mcp-session-id": "sse-session",
              },
            },
          );
        }

        if (body.method === "notifications/initialized") {
          return new Response("{}", {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        // tools/list
        return new Response(
          `data: ${JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              tools: [
                {
                  name: "FindRelatedDocs",
                  description: "Find related docs",
                  inputSchema: { type: "object", properties: {} },
                },
              ],
            },
          })}\n\n`,
          {
            status: 200,
            headers: {
              "content-type": "text/event-stream",
              "mcp-session-id": "sse-session",
            },
          },
        );
      }),
    );

    const tools = await getElasticDocsTools();
    expect(tools).toHaveProperty("FindRelatedDocs");
  });
});
