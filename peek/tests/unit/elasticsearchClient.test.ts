import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ElasticsearchClient,
  isElasticsearchError,
} from "../../src/services/es/client";
import type { ElasticsearchConnection } from "../../src/services/es/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchOnce(body: unknown, init?: ResponseInit) {
  return vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(body), init));
}

function mockFetchSequence(
  ...responses: Array<{ body: unknown; init?: ResponseInit }>
) {
  const fn = vi.fn();
  for (const { body, init } of responses) {
    fn.mockResolvedValueOnce(new Response(JSON.stringify(body), init));
  }
  return fn;
}

const BASE_URL = "https://my-cluster.es.io:9243";

function makeClient(
  overrides: Partial<ElasticsearchConnection> = {},
): ElasticsearchClient {
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

  it("strips trailing slashes from the base URL", async () => {
    const fetchSpy = mockFetchOnce({ cluster_name: "test" });
    vi.stubGlobal("fetch", fetchSpy);

    const client = new ElasticsearchClient({ url: `${BASE_URL}///` });
    await client.getClusterInfo();

    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe(`${BASE_URL}/`);
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

// ── Error handling ────────────────────────────────────────────────────────

describe("error handling", () => {
  it("throws ElasticsearchError with status and parsed message on non-OK response", async () => {
    const esBody = {
      error: { reason: "index_not_found_exception" },
    };
    vi.stubGlobal(
      "fetch",
      mockFetchOnce(esBody, { status: 404, statusText: "Not Found" }),
    );

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
    vi.stubGlobal(
      "fetch",
      mockFetchOnce(esBody, { status: 400, statusText: "Bad Request" }),
    );

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
    vi.stubGlobal(
      "fetch",
      mockFetchOnce(esBody, { status: 400, statusText: "Bad Request" }),
    );

    const client = makeClient();
    await expect(client.getClusterInfo()).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        message: "root cause reason",
      }),
    );
  });

  it("does not retry on 400", async () => {
    const fetchSpy = mockFetchOnce(
      { error: { reason: "bad request" } },
      { status: 400 },
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await expect(client.getClusterInfo()).rejects.toEqual(
      expect.objectContaining({ status: 400 }),
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 500", async () => {
    const fetchSpy = mockFetchOnce(
      { error: { reason: "internal error" } },
      { status: 500 },
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await expect(client.getClusterInfo()).rejects.toEqual(
      expect.objectContaining({ status: 500 }),
    );

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

  it("retries on 503 and succeeds on a later attempt", async () => {
    const fetchSpy = mockFetchSequence(
      { body: { error: { reason: "unavailable" } }, init: { status: 503 } },
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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

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

    await expect(promise).rejects.toEqual(
      expect.objectContaining({ status: 0 }),
    );
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
      { cluster: { manage_data_stream: true } },
      { status: 200 },
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ apiKey: "key" });
    const caps = await client.getCapabilities();

    expect(caps.canManageDataStreams).toBe(true);
  });

  it("returns canManageDataStreams: false when cluster privilege is denied", async () => {
    const fetchSpy = mockFetchOnce(
      { cluster: { manage_data_stream: false } },
      { status: 200 },
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ apiKey: "key" });
    const caps = await client.getCapabilities();

    expect(caps.canManageDataStreams).toBe(false);
  });

  it("falls back to canManageDataStreams: false when the security API returns an error", async () => {
    const fetchSpy = mockFetchOnce(
      { error: { reason: "security_exception" } },
      { status: 403 },
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient({ apiKey: "key" });
    const caps = await client.getCapabilities();

    expect(caps.canManageDataStreams).toBe(false);
  });

  it("falls back to canManageDataStreams: false on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const client = makeClient({ apiKey: "key" });
    const caps = await client.getCapabilities();

    expect(caps.canManageDataStreams).toBe(false);
  });

  it("POSTs to /_security/user/_has_privileges with the expected body", async () => {
    const fetchSpy = mockFetchOnce(
      { cluster: { manage_data_stream: false } },
      { status: 200 },
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = makeClient();
    await client.getCapabilities();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/_security/user/_has_privileges`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ cluster: ["manage_data_stream"] });
  });
});
