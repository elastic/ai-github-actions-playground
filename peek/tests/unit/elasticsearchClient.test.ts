import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ElasticsearchClient, isElasticsearchError } from "../../src/services/es";
import type { ElasticsearchConnection } from "../../src/services/es";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchOnce(body: unknown, init?: ResponseInit) {
  return vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(body), init));
}

function mockFetchSequence(...responses: Array<{ body: unknown; init?: ResponseInit }>) {
  const fn = vi.fn();
  for (const { body, init } of responses) {
    fn.mockResolvedValueOnce(new Response(JSON.stringify(body), init));
  }
  return fn;
}

const BASE_URL = "https://my-cluster.es.io:9243";

function makeClient(overrides: Partial<ElasticsearchConnection> = {}): ElasticsearchClient {
  return new ElasticsearchClient({ url: BASE_URL, ...overrides });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ── Auth headers ──────────────────────────────────────────────────────────

describe("auth headers", () => {
  it("sets Basic auth header from username + password", async () => {
    const fetchSpy = mockFetchOnce({ cluster_name: "test" });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ username: "elastic", password: "changeme" });
    await client.getClusterInfo();

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const authHeader = (init.headers as Record<string, string>)["Authorization"];
    // "elastic:changeme" → base64
    expect(authHeader).toBe(`Basic ${btoa("elastic:changeme")}`);
  });

  it("sets ApiKey auth header", async () => {
    const fetchSpy = mockFetchOnce({ cluster_name: "test" });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ apiKey: "my-api-key" });
    await client.getClusterInfo();

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const authHeader = (init.headers as Record<string, string>)["Authorization"];
    expect(authHeader).toBe("ApiKey my-api-key");
  });

  it("sends no Authorization header when neither auth method is provided", async () => {
    const fetchSpy = mockFetchOnce({ cluster_name: "test" });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getClusterInfo();

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });

  it("sends proxy host header derived from url when proxyUrl is configured", async () => {
    const fetchSpy = mockFetchOnce({ cluster_name: "test" });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({
      proxyUrl: "http://localhost:3000/_es",
    });
    await client.getClusterInfo();

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Elastic-Peek-Proxy-Host"]).toBe(BASE_URL);
  });
});

// ── Request construction ──────────────────────────────────────────────────

describe("request construction", () => {
  it("query() POSTs to /_query?format=json with JSON body", async () => {
    const fetchSpy = mockFetchOnce({ columns: [], values: [] });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.query({ query: "FROM logs-* | LIMIT 1" });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/_query?format=json`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      query: "FROM logs-* | LIMIT 1",
    });
  });

  it("query() converts object params to array of single-key objects", async () => {
    const fetchSpy = mockFetchOnce({ columns: [], values: [] });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.query({
      query: "FROM logs-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend",
      params: { _tstart: "2025-01-01T00:00:00Z", _tend: "2025-01-02T00:00:00Z" },
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.params).toEqual([
      { _tstart: "2025-01-01T00:00:00Z" },
      { _tend: "2025-01-02T00:00:00Z" },
    ]);
  });

  it("query() leaves array params untouched", async () => {
    const fetchSpy = mockFetchOnce({ columns: [], values: [] });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.query({
      query: "FROM logs-* | LIMIT ?",
      params: [10],
    } as never);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.params).toEqual([10]);
  });

  it("getClusterInfo() GETs /", async () => {
    const fetchSpy = mockFetchOnce({ cluster_name: "test" });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getClusterInfo();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/`);
    expect(init.method).toBeUndefined(); // GET is the default
  });

  it("getDataStreams() GETs /_data_stream", async () => {
    const fetchSpy = mockFetchOnce({ data_streams: [] });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getDataStreams();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/_data_stream`);
    expect(init.method).toBeUndefined();
  });

  it("getSecurityUsers() GETs /_security/user", async () => {
    const fetchSpy = mockFetchOnce({});
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getSecurityUsers();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/_security/user`);
    expect(init.method).toBeUndefined();
  });

  it("getSecurityRoles() GETs /_security/role", async () => {
    const fetchSpy = mockFetchOnce({});
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getSecurityRoles();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/_security/role`);
    expect(init.method).toBeUndefined();
  });

  it("resolveIndex() GETs encoded /_resolve/index/{name}", async () => {
    const fetchSpy = mockFetchOnce({ indices: [], aliases: [], data_streams: [] });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.resolveIndex("logs-*,metrics-*");

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/_resolve/index/logs-*%2Cmetrics-*`);
  });

  it("getFieldCaps() appends fields query parameter", async () => {
    const fetchSpy = mockFetchOnce({ fields: {}, indices: [] });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getFieldCaps("logs-*", ["@timestamp", "message"]);

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/logs-*/_field_caps?fields=%40timestamp%2Cmessage`);
  });

  it("getFieldCaps() defaults to wildcard fields when none are provided", async () => {
    const fetchSpy = mockFetchOnce({ fields: {}, indices: [] });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getFieldCaps("logs-*");

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/logs-*/_field_caps?fields=*`);
  });

  it("getCatIndices() GETs /_cat/indices?format=json&bytes=b", async () => {
    const fetchSpy = mockFetchOnce([]);
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getCatIndices();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/_cat/indices?format=json&bytes=b`);
    expect(init.method).toBeUndefined();
  });

  it("getIndexStats() GETs /{index}/_stats with encoded name", async () => {
    const fetchSpy = mockFetchOnce({ _all: {} });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getIndexStats("my-index");

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/my-index/_stats`);
  });

  it("getIndexMappings() GETs /{index}/_mapping", async () => {
    const fetchSpy = mockFetchOnce({ "my-index": { mappings: {} } });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getIndexMappings("my-index");

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/my-index/_mapping`);
  });

  it("getIndexSettings() GETs /{index}/_settings", async () => {
    const fetchSpy = mockFetchOnce({ "my-index": { settings: {} } });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getIndexSettings("my-index");

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/my-index/_settings`);
  });

  it("getIndexDiskUsage() POSTs /{index}/_disk_usage?run_expensive_tasks=true", async () => {
    const fetchSpy = mockFetchOnce({
      _shards: { total: 1 },
      "my-index": { store_size_in_bytes: 1024, fields: {} },
    });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getIndexDiskUsage("my-index");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/my-index/_disk_usage?run_expensive_tasks=true`);
    expect(init.method).toBe("POST");
  });

  it("strips trailing slashes from the base URL", async () => {
    const fetchSpy = mockFetchOnce({ cluster_name: "test" });
    vi.stubGlobal("fetch", fetchSpy);

    const client = new ElasticsearchClient({ url: `${BASE_URL}///` });
    await client.getClusterInfo();

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/`);
  });

  it("uses proxyUrl as base URL when provided", async () => {
    const fetchSpy = mockFetchOnce({ cluster_name: "test" });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ proxyUrl: "http://localhost:3000/_es/" });
    await client.getClusterInfo();

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe("http://localhost:3000/_es/");
  });
});

// ── Success parsing ───────────────────────────────────────────────────────

describe("success parsing", () => {
  it("returns typed response with executionTimeMs", async () => {
    const body = {
      columns: [{ name: "count", type: "long" }],
      values: [[42]],
    };
    vi.stubGlobal("fetch", mockFetchOnce(body));

    const client = makeClient();
    const result = await client.query({ query: "FROM test" });

    expect(result.columns).toEqual(body.columns);
    expect(result.values).toEqual(body.values);
    expect(typeof result.executionTimeMs).toBe("number");
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });
});

// ── Response validation ───────────────────────────────────────────────────

describe("response validation", () => {
  it("rejects ES|QL response with missing columns", async () => {
    vi.stubGlobal("fetch", mockFetchOnce({ values: [[1]] }));

    const client = makeClient();
    await expect(client.query({ query: "FROM test" })).rejects.toEqual(
      expect.objectContaining({
        status: 0,
        message: expect.stringContaining("ES|QL query"),
      }),
    );
  });

  it("rejects cluster health response with invalid status enum", async () => {
    vi.stubGlobal("fetch", mockFetchOnce({ status: "blue" }));

    const client = makeClient();
    await expect(client.getClusterHealth()).rejects.toEqual(
      expect.objectContaining({
        status: 0,
        message: expect.stringContaining("cluster health"),
      }),
    );
  });

  it("accepts valid cluster health response through validation", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce({ cluster_name: "test", status: "green", number_of_nodes: 3 }),
    );

    const client = makeClient();
    const result = await client.getClusterHealth();
    expect(result.status).toBe("green");
    expect(result.number_of_nodes).toBe(3);
  });

  it("rejects cat indices response that is not an array", async () => {
    vi.stubGlobal("fetch", mockFetchOnce({ indices: "bad" }));

    const client = makeClient();
    await expect(client.getCatIndices()).rejects.toEqual(
      expect.objectContaining({
        status: 0,
        message: expect.stringContaining("cat indices"),
      }),
    );
  });

  it("rejects data streams response missing data_streams key", async () => {
    vi.stubGlobal("fetch", mockFetchOnce({ streams: [] }));

    const client = makeClient();
    await expect(client.getDataStreams()).rejects.toEqual(
      expect.objectContaining({
        status: 0,
        message: expect.stringContaining("data streams"),
      }),
    );
  });
});

// ── Error handling ────────────────────────────────────────────────────────

describe("error handling", () => {
  it("throws ElasticsearchError with status and parsed message on non-OK response", async () => {
    const esBody = {
      error: { reason: "index_not_found_exception" },
    };
    vi.stubGlobal("fetch", mockFetchOnce(esBody, { status: 404, statusText: "Not Found" }));

    const client = makeClient();
    await expect(client.getClusterInfo()).rejects.toEqual(
      expect.objectContaining({
        status: 404,
        message: "index_not_found_exception",
      }),
    );
  });

  it("parses caused_by from ES error body", async () => {
    const esBody = {
      error: {
        reason: "parsing_exception",
        caused_by: { reason: "Unknown column [foo]" },
      },
    };
    vi.stubGlobal("fetch", mockFetchOnce(esBody, { status: 400, statusText: "Bad Request" }));

    const client = makeClient();
    await expect(client.query({ query: "bad" })).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        message: "parsing_exception",
        cause: "Unknown column [foo]",
      }),
    );
  });

  it("falls back to root_cause reason", async () => {
    const esBody = {
      error: {
        root_cause: [{ reason: "root cause reason" }],
      },
    };
    vi.stubGlobal("fetch", mockFetchOnce(esBody, { status: 400, statusText: "Bad Request" }));

    const client = makeClient();
    await expect(client.getClusterInfo()).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        message: "root cause reason",
      }),
    );
  });

  it("does not retry on 400", async () => {
    const fetchSpy = mockFetchOnce({ error: { reason: "bad request" } }, { status: 400 });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await expect(client.getClusterInfo()).rejects.toEqual(expect.objectContaining({ status: 400 }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 500", async () => {
    const fetchSpy = mockFetchOnce({ error: { reason: "internal error" } }, { status: 500 });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await expect(client.getClusterInfo()).rejects.toEqual(expect.objectContaining({ status: 500 }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

// ── Retry logic ───────────────────────────────────────────────────────────

describe("retry logic", () => {
  it("retries on 429 up to 3 times then throws", async () => {
    const fetchSpy = mockFetchSequence(
      { body: { error: { reason: "too many requests" } }, init: { status: 429 } },
      { body: { error: { reason: "too many requests" } }, init: { status: 429 } },
      { body: { error: { reason: "too many requests" } }, init: { status: 429 } },
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    // Attach catch handler immediately so the rejection is never "unhandled"
    const promise = client.getClusterInfo();
    const settled = promise.catch((e: unknown) => e);

    await vi.runAllTimersAsync();

    const error = await settled;
    expect(error).toEqual(expect.objectContaining({ status: 429 }));
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("retries on 504 and succeeds on a later attempt", async () => {
    const fetchSpy = mockFetchSequence(
      { body: { error: { reason: "gateway timeout" } }, init: { status: 504 } },
      { body: { cluster_name: "recovered" }, init: { status: 200 } },
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    const promise = client.getClusterInfo();

    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toEqual(expect.objectContaining({ cluster_name: "recovered" }));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

// ── Network errors ────────────────────────────────────────────────────────

describe("network errors", () => {
  it("produces ElasticsearchError with status 0 when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const client = makeClient();
    await expect(client.getClusterInfo()).rejects.toEqual(
      expect.objectContaining({
        status: 0,
        message: "Failed to fetch",
      }),
    );
  });
});

// ── Abort signal ──────────────────────────────────────────────────────────

describe("abort signal", () => {
  it("rejects when aborted during request", async () => {
    vi.useRealTimers(); // abort tests need real timers
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            controller.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );

    const client = makeClient();
    const promise = client.getClusterInfo(controller.signal);
    controller.abort();

    await expect(promise).rejects.toEqual(expect.objectContaining({ status: 0 }));
  });
});

// ── isElasticsearchError ──────────────────────────────────────────────────

describe("isElasticsearchError", () => {
  it("returns true for { status: number, message: string }", () => {
    expect(isElasticsearchError({ status: 404, message: "not found" })).toBe(true);
    expect(isElasticsearchError({ status: 0, message: "network" })).toBe(true);
  });

  it("returns false for plain Error", () => {
    expect(isElasticsearchError(new Error("fail"))).toBe(false);
  });

  it("returns false for string", () => {
    expect(isElasticsearchError("error")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isElasticsearchError(null)).toBe(false);
  });

  it("returns false for object missing status", () => {
    expect(isElasticsearchError({ message: "no status" })).toBe(false);
  });

  it("returns false for object missing message", () => {
    expect(isElasticsearchError({ status: 500 })).toBe(false);
  });
});

// ── getCapabilities ───────────────────────────────────────────────────────

describe("getCapabilities", () => {
  it("returns canManageDataStreams: true when cluster privilege is granted", async () => {
    const fetchSpy = mockFetchOnce(
      { cluster: { manage: true, read_security: true, read_pipeline: true } },
      { status: 200 },
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ apiKey: "key" });
    const caps = await client.getCapabilities();

    expect(caps.canManageDataStreams).toBe(true);
    expect(caps.canReadSecurityUsers).toBe(true);
    expect(caps.canReadSecurityRoles).toBe(true);
    expect(caps.canReadIngestPipelines).toBe(true);
  });

  it("returns canManageDataStreams: false when cluster privilege is denied", async () => {
    const fetchSpy = mockFetchOnce({ cluster: { manage: false } }, { status: 200 });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ apiKey: "key" });
    const caps = await client.getCapabilities();

    expect(caps.canManageDataStreams).toBe(false);
    expect(caps.canReadSecurityUsers).toBe(false);
    expect(caps.canReadSecurityRoles).toBe(false);
    expect(caps.canReadIngestPipelines).toBe(false);
  });

  it("falls back to minimal capabilities when the security API returns 403", async () => {
    const fetchSpy = mockFetchOnce({ error: { reason: "security_exception" } }, { status: 403 });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ apiKey: "key" });
    const caps = await client.getCapabilities();

    expect(caps.canManageDataStreams).toBe(false);
    expect(caps.canReadSecurityUsers).toBe(false);
    expect(caps.canReadSecurityRoles).toBe(false);
    expect(caps.canReadIngestPipelines).toBe(false);
  });

  it("returns canReadIngestPipelines: true when manage_ingest_pipelines privilege is granted", async () => {
    const fetchSpy = mockFetchOnce(
      { cluster: { manage: false, manage_ingest_pipelines: true } },
      { status: 200 },
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ apiKey: "key" });
    const caps = await client.getCapabilities();

    expect(caps.canReadIngestPipelines).toBe(true);
    expect(caps.canManageDataStreams).toBe(false);
  });

  it("falls back to optimistic capabilities when the security API returns 400 (no security plugin)", async () => {
    const fetchSpy = mockFetchOnce(
      {
        error: {
          reason: "no handler found for uri [/_security/user/_has_privileges] and method [POST]",
        },
      },
      { status: 400 },
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ apiKey: "key" });
    const caps = await client.getCapabilities();

    expect(caps.canManageDataStreams).toBe(true);
    expect(caps.canCreateApiKeys).toBe(true);
    expect(caps.canReadSecurityUsers).toBe(true);
    expect(caps.canReadSecurityRoles).toBe(true);
    expect(caps.canReadApiKeys).toBe(true);
    expect(caps.canReadIngestPipelines).toBe(true);
  });

  it("re-throws on a generic 400 Bad Request from _has_privileges (not a security-disabled signature)", async () => {
    const fetchSpy = mockFetchOnce({ error: { reason: "Bad Request" } }, { status: 400 });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ apiKey: "key" });
    await expect(client.getCapabilities()).rejects.toMatchObject({ status: 400 });
  });

  it("returns optimistic capabilities when the _has_privileges endpoint returns 404", async () => {
    const fetchSpy = mockFetchOnce({}, { status: 404 });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ apiKey: "key" });
    const caps = await client.getCapabilities();

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/_security/user/_has_privileges`);
    expect(caps.canManageDataStreams).toBe(true);
    expect(caps.canCreateApiKeys).toBe(true);
    expect(caps.canReadSecurityUsers).toBe(true);
    expect(caps.canReadSecurityRoles).toBe(true);
    expect(caps.canReadApiKeys).toBe(true);
    expect(caps.canReadIngestPipelines).toBe(true);
  });

  it("re-throws on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const client = makeClient({ apiKey: "key" });

    await expect(client.getCapabilities()).rejects.toMatchObject({
      status: 0,
      message: "Failed to fetch",
    });
  });

  it("re-throws on a 401 Unauthorized error", async () => {
    const fetchSpy = mockFetchOnce(
      { error: { reason: "missing authentication credentials" } },
      { status: 401 },
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ apiKey: "key" });

    await expect(client.getCapabilities()).rejects.toMatchObject({
      status: 401,
      message: "missing authentication credentials",
    });
  });

  it("POSTs to /_security/user/_has_privileges with the expected body", async () => {
    const fetchSpy = mockFetchOnce({ cluster: { manage: false } }, { status: 200 });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getCapabilities();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/_security/user/_has_privileges`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      cluster: [
        "manage",
        "read_security",
        "manage_security",
        "manage_own_api_key",
        "manage_api_key",
        "read_pipeline",
        "manage_ingest_pipelines",
      ],
    });
  });
});

// ── rawRequest (API console) ───────────────────────────────────────────────

describe("rawRequest", () => {
  it("normalizes path without a leading slash", async () => {
    const fetchSpy = mockFetchOnce({ ok: true }, { status: 200 });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.rawRequest("GET", "_cat/indices?v");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/_cat/indices?v`);
    expect(init.method).toBe("GET");
  });

  it("sends request body only when provided", async () => {
    const fetchSpy = mockFetchOnce({ acknowledged: true }, { status: 200 });
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.rawRequest("POST", "/_bulk", '{"index":{}}');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe('{"index":{}}');
  });

  it("parses JSON responses when content-type is application/json", async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ hits: { total: 1 } }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    const result = await client.rawRequest("GET", "/_search");
    expect(result).toEqual({ status: 200, body: { hits: { total: 1 } } });
  });

  it("parses plain-text responses when content-type is not JSON", async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce(
      new Response("green 1 1 0 0 0 0 0 0 -", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    const result = await client.rawRequest("GET", "/_cat/health?v");
    expect(result).toEqual({ status: 200, body: "green 1 1 0 0 0 0 0 0 -" });
  });

  it("maps fetch failures to ElasticsearchError shape", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));

      const client = makeClient();
      const pending = expect(client.rawRequest("GET", "/")).rejects.toEqual(
        expect.objectContaining({ status: 0, message: "network down" }),
      );
      // Advance past retry back-off delays so the promise settles
      await vi.advanceTimersByTimeAsync(60_000);
      await pending;
    } finally {
      vi.useRealTimers();
    }
  });
});
