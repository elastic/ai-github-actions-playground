import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  getFieldsForIndex,
  invalidateSchema,
  _clearCacheForTesting,
  MAX_FIELDS,
} from "../../src/services/schemaCache";
import type { ElasticsearchConnection } from "../../src/services/es/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONNECTION: ElasticsearchConnection = { url: "https://test-cluster.es.io" };

function makeFieldCapsResponse(fields: Record<string, string>) {
  return {
    fields: Object.fromEntries(
      Object.entries(fields).map(([name, type]) => [
        name,
        { [type]: { type, metadata_field: false, searchable: true, aggregatable: true } },
      ]),
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  _clearCacheForTesting();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getFieldsForIndex", () => {
  it("returns fields from the cluster on a cache miss", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            makeFieldCapsResponse({ "@timestamp": "date", "host.name": "keyword", bytes: "long" }),
          ),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const fields = await getFieldsForIndex(CONNECTION, "logs-*");

    expect(fields).toHaveLength(3);
    expect(fields.map((f) => f.name)).toEqual(["@timestamp", "bytes", "host.name"]);
    expect(fields.find((f) => f.name === "host.name")?.type).toBe("keyword");
  });

  it("returns cached results on a cache hit without fetching", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(makeFieldCapsResponse({ "@timestamp": "date" })), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getFieldsForIndex(CONNECTION, "logs-*");
    const secondResult = await getFieldsForIndex(CONNECTION, "logs-*");

    // fetch was only called once
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(secondResult).toHaveLength(1);
  });

  it("scopes cache entries by credentials for the same URL", async () => {
    const keyA: ElasticsearchConnection = { url: CONNECTION.url, apiKey: "key-a" };
    const keyB: ElasticsearchConnection = { url: CONNECTION.url, apiKey: "key-b" };
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(makeFieldCapsResponse({ "@timestamp": "date" })), {
          status: 200,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getFieldsForIndex(keyA, "logs-*");
    await getFieldsForIndex(keyB, "logs-*");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent misses for the same cache key", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = getFieldsForIndex(CONNECTION, "logs-*");
    const second = getFieldsForIndex(CONNECTION, "logs-*");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch?.(
      new Response(JSON.stringify(makeFieldCapsResponse({ bytes: "long" })), { status: 200 }),
    );

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toEqual(secondResult);
    expect(firstResult).toHaveLength(1);
  });

  it("returns an empty array when the cluster is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network failure")));

    const fields = await getFieldsForIndex(CONNECTION, "missing-*");
    expect(fields).toEqual([]);
  });

  it("deduplicates fields that appear under multiple capability types", async () => {
    // Some fields expose both "keyword" and "text" capabilities
    const response = {
      fields: {
        message: {
          text: { type: "text", metadata_field: false, searchable: true, aggregatable: false },
          keyword: { type: "keyword", metadata_field: false, searchable: true, aggregatable: true },
        },
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 })),
    );

    const fields = await getFieldsForIndex(CONNECTION, "logs-*");
    expect(fields.filter((f) => f.name === "message")).toHaveLength(1);
  });

  it(`caps results at MAX_FIELDS (${MAX_FIELDS}) for high-cardinality indices`, async () => {
    const manyFields: Record<string, string> = {};
    for (let i = 0; i < MAX_FIELDS + 100; i++) {
      manyFields[`field_${i}`] = "keyword";
    }
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify(makeFieldCapsResponse(manyFields)), { status: 200 }),
        ),
    );

    const fields = await getFieldsForIndex(CONNECTION, "large-index-*");
    expect(fields).toHaveLength(MAX_FIELDS);
  });

  it("re-fetches after the cache entry expires", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(makeFieldCapsResponse({ "@timestamp": "date" })), {
          status: 200,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getFieldsForIndex(CONNECTION, "logs-*");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance past the 5-minute TTL
    vi.advanceTimersByTime(6 * 60 * 1000);

    await getFieldsForIndex(CONNECTION, "logs-*");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

describe("invalidateSchema", () => {
  it("removes cached entries for the given connection", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(makeFieldCapsResponse({ "@timestamp": "date" })), {
          status: 200,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getFieldsForIndex(CONNECTION, "logs-*");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    invalidateSchema(CONNECTION);

    // After invalidation a cache miss should trigger a new fetch
    await getFieldsForIndex(CONNECTION, "logs-*");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not affect entries for a different connection", async () => {
    const other: ElasticsearchConnection = { url: "https://other-cluster.es.io" };
    // Use mockImplementation so a fresh Response (with a consumable body) is
    // returned for each fetch call.
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(makeFieldCapsResponse({ "agent.id": "keyword" })), {
          status: 200,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getFieldsForIndex(CONNECTION, "logs-*");
    await getFieldsForIndex(other, "metrics-*");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    invalidateSchema(CONNECTION);

    // Only CONNECTION should be invalidated; `other` should still be cached
    await getFieldsForIndex(other, "metrics-*");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
