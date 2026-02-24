import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

import { useBatchedOverviewQueries } from "../../src/hooks/useBatchedOverviewQueries";
import type { ElasticsearchClient } from "../../src/services/es";
import type { EsqlResponse, TimeRange } from "../../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient(
  impl: (params: { query: string }, signal?: AbortSignal) => Promise<EsqlResponse>,
): ElasticsearchClient {
  return { query: vi.fn(impl) } as unknown as ElasticsearchClient;
}

function makeResponse(metricValue: number | null): EsqlResponse {
  return {
    columns: [
      { name: "@timestamp", type: "date" },
      { name: "metric", type: "double" },
    ],
    values:
      metricValue !== null
        ? [["2025-01-01T00:00:00Z", metricValue]]
        : [["2025-01-01T00:00:00Z", null]],
  };
}

const TIME_RANGE: TimeRange = { from: "now-1h", to: "now" };

function makeItems(names: string[]) {
  return names.map((name) => ({ name }));
}

function buildQuery(item: { name: string }) {
  return { esql: `FROM index | STATS metric BY ${item.name}` };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useBatchedOverviewQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty results when client is null", () => {
    const { result } = renderHook(() =>
      useBatchedOverviewQueries({
        items: makeItems(["cpu", "mem"]),
        client: null,
        scopeKey: "test",
        buildQuery,
        timeRange: TIME_RANGE,
      }),
    );

    expect(result.current).toEqual({});
  });

  it("returns empty results when items array is empty", () => {
    const client = makeClient(() => Promise.resolve(makeResponse(1)));

    const { result } = renderHook(() =>
      useBatchedOverviewQueries({
        items: [],
        client,
        scopeKey: "test",
        buildQuery,
        timeRange: TIME_RANGE,
      }),
    );

    expect(result.current).toEqual({});
  });

  it("marks items as loading then resolves them to success", async () => {
    const client = makeClient(() => Promise.resolve(makeResponse(42)));
    const items = makeItems(["cpu", "mem"]);

    const { result } = renderHook(() =>
      useBatchedOverviewQueries({
        items,
        client,
        scopeKey: "scope1",
        buildQuery,
        timeRange: TIME_RANGE,
      }),
    );

    await waitFor(() => {
      expect(result.current["cpu"]?.status).toBe("success");
      expect(result.current["mem"]?.status).toBe("success");
    });

    expect(result.current["cpu"]?.data).toBeDefined();
    expect(result.current["mem"]?.data).toBeDefined();
  });

  it("sets status to error for a failed query (non-abort)", async () => {
    const client = makeClient((_, signal) => {
      if (signal?.aborted) {
        const err = new DOMException("aborted", "AbortError");
        return Promise.reject(err);
      }
      return Promise.reject(new Error("query failed"));
    });
    const items = makeItems(["cpu"]);

    const { result } = renderHook(() =>
      useBatchedOverviewQueries({
        items,
        client,
        scopeKey: "scope1",
        buildQuery,
        timeRange: TIME_RANGE,
      }),
    );

    await waitFor(() => {
      expect(result.current["cpu"]?.status).toBe("error");
    });
  });

  it("aborts in-flight queries when unmounted", async () => {
    let capturedSignal: AbortSignal | undefined;
    const items = makeItems(["cpu"]);

    const client = makeClient(
      (_, signal) =>
        new Promise<EsqlResponse>((resolve) => {
          capturedSignal = signal;
          // never resolves unless signal fires
          if (signal) {
            signal.addEventListener("abort", () => resolve(makeResponse(null)));
          }
        }),
    );

    const { unmount } = renderHook(() =>
      useBatchedOverviewQueries({
        items,
        client,
        scopeKey: "scope1",
        buildQuery,
        timeRange: TIME_RANGE,
      }),
    );

    await waitFor(() => expect(capturedSignal).toBeDefined());

    act(() => {
      unmount();
    });

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("clears the known-with-data cache when scopeKey changes", async () => {
    let callCount = 0;
    const client = makeClient(() => {
      callCount++;
      return Promise.resolve(makeResponse(10));
    });
    const items = makeItems(["cpu"]);

    let scope = "scope-a";
    const { result, rerender } = renderHook(() =>
      useBatchedOverviewQueries({
        items,
        client,
        scopeKey: scope,
        buildQuery,
        timeRange: TIME_RANGE,
      }),
    );

    await waitFor(() => expect(result.current["cpu"]?.status).toBe("success"));
    const firstCount = callCount;

    // Change scopeKey — should trigger a full discovery pass again
    scope = "scope-b";
    rerender();

    await waitFor(() => expect(callCount).toBeGreaterThan(firstCount));
  });

  it("only re-queries items with data on refresh (same scopeKey)", async () => {
    // cpu returns data; mem returns null metric
    const client = makeClient((params) => {
      const hasCpu = params.query.includes("cpu");
      return Promise.resolve(makeResponse(hasCpu ? 10 : null));
    });

    // Use a `let` so rerender picks up the new reference from the closure.
    let items = makeItems(["cpu", "mem"]);
    const { result, rerender } = renderHook(() =>
      useBatchedOverviewQueries({
        items,
        client,
        scopeKey: "stable-scope",
        buildQuery,
        timeRange: TIME_RANGE,
      }),
    );

    // Wait for initial discovery
    await waitFor(() => {
      expect(result.current["cpu"]?.status).toBe("success");
      expect(result.current["mem"]?.status).toBe("success");
    });

    const callsBefore = (client.query as ReturnType<typeof vi.fn>).mock.calls.length;

    // Simulate a refresh: items gets a new reference (e.g., from field re-discovery)
    // while scopeKey stays the same, so knownWithDataRef is preserved.
    items = makeItems(["cpu", "mem"]);
    rerender();

    await waitFor(() =>
      expect((client.query as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
        callsBefore,
      ),
    );

    const callsAfter = (client.query as ReturnType<typeof vi.fn>).mock.calls.length;
    // Only cpu (had data) should be re-queried, not mem
    expect(callsAfter - callsBefore).toBe(1);
  });

  it("respects batchSize — queries in groups", async () => {
    const callOrder: string[] = [];

    const client = makeClient(
      (params) =>
        new Promise<EsqlResponse>((resolve) => {
          // Extract item name from the query string
          const match = /STATS metric BY (\S+)/.exec(params.query);
          if (match) callOrder.push(match[1]!);
          setTimeout(() => resolve(makeResponse(1)), 0);
        }),
    );

    const items = makeItems(["a", "b", "c", "d"]);

    const { result } = renderHook(() =>
      useBatchedOverviewQueries({
        items,
        client,
        scopeKey: "scope1",
        buildQuery,
        timeRange: TIME_RANGE,
        batchSize: 2,
      }),
    );

    await waitFor(() => {
      expect(result.current["a"]?.status).toBe("success");
      expect(result.current["b"]?.status).toBe("success");
      expect(result.current["c"]?.status).toBe("success");
      expect(result.current["d"]?.status).toBe("success");
    });

    // All 4 items should have been queried
    expect(callOrder).toHaveLength(4);
    // First batch: a and b should appear before c and d
    expect(callOrder.indexOf("a")).toBeLessThan(callOrder.indexOf("c"));
    expect(callOrder.indexOf("b")).toBeLessThan(callOrder.indexOf("d"));
  });
});
