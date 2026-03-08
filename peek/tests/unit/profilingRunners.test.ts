import { describe, expect, it, vi } from "vitest";

import {
  executeProfilingRun,
  fetchStacktraces,
  fetchTimeline,
  fetchTopFunctions,
} from "../../src/components/profiling/profilingRunners";
import type { ElasticsearchClient } from "../../src/services/es";
import { EMPTY_PROFILING_FILTERS } from "../../src/types/pageFilters";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockClient(overrides: Partial<ElasticsearchClient> = {}): ElasticsearchClient {
  return {
    query: vi.fn().mockResolvedValue({ columns: [], values: [] }),
    getTopFunctions: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ElasticsearchClient;
}

const FILTERS = { ...EMPTY_PROFILING_FILTERS, timeFrom: "NOW() - 1 hour", timeTo: "NOW()" };

// ---------------------------------------------------------------------------
// fetchTopFunctions
// ---------------------------------------------------------------------------

describe("fetchTopFunctions", () => {
  it("calls getTopFunctions and normalizes the response", async () => {
    const client = mockClient({
      getTopFunctions: vi
        .fn()
        .mockResolvedValue([{ frame: { function_name: "main" }, self_count: 10, total_count: 20 }]),
    });
    const rows = await fetchTopFunctions(client, FILTERS, new AbortController().signal);
    expect(rows).toEqual([{ functionName: "main", selfCount: 10, totalCount: 20 }]);
    expect(client.getTopFunctions).toHaveBeenCalledOnce();
  });

  it("returns empty array for empty response", async () => {
    const client = mockClient({ getTopFunctions: vi.fn().mockResolvedValue([]) });
    const rows = await fetchTopFunctions(client, FILTERS, new AbortController().signal);
    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fetchTimeline
// ---------------------------------------------------------------------------

describe("fetchTimeline", () => {
  it("returns the raw ES|QL response", async () => {
    const response = {
      columns: [{ name: "@timestamp", type: "date" }],
      values: [["2026-01-01T00:00:00Z"]],
    };
    const client = mockClient({ query: vi.fn().mockResolvedValue(response) });
    const result = await fetchTimeline(
      client,
      "FROM profiling-events-all",
      new AbortController().signal,
    );
    expect(result).toBe(response);
    expect(client.query).toHaveBeenCalledWith(
      { query: "FROM profiling-events-all" },
      expect.any(AbortSignal),
    );
  });
});

// ---------------------------------------------------------------------------
// fetchStacktraces
// ---------------------------------------------------------------------------

describe("fetchStacktraces", () => {
  it("returns empty array when no events have stacktrace IDs", async () => {
    const client = mockClient({
      query: vi.fn().mockResolvedValue({
        columns: [
          { name: "@timestamp", type: "date" },
          { name: "Stacktrace.id", type: "keyword" },
          { name: "Stacktrace.count", type: "long" },
          { name: "service.name", type: "keyword" },
          { name: "host.name", type: "keyword" },
        ],
        values: [["2026-01-01T00:00:00Z", "", 1, "svc", "host"]],
      }),
    });
    const result = await fetchStacktraces(
      client,
      "FROM profiling-events-all",
      new AbortController().signal,
    );
    expect(result).toEqual([]);
    // Only one query call (events); no stacktrace/frame lookups
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("runs full pipeline and returns symbolized stacktraces", async () => {
    const queryMock = vi
      .fn()
      // 1st call: events query
      .mockResolvedValueOnce({
        columns: [
          { name: "@timestamp", type: "date" },
          { name: "Stacktrace.id", type: "keyword" },
          { name: "Stacktrace.count", type: "long" },
          { name: "service.name", type: "keyword" },
          { name: "host.name", type: "keyword" },
        ],
        values: [["2026-01-01T00:00:00Z", "st1", 5, "my-svc", "host-a"]],
      })
      // 2nd call: stacktrace lookup
      .mockResolvedValueOnce({
        columns: [
          { name: "_id", type: "keyword" },
          { name: "Stacktrace.frame.ids", type: "keyword" },
          { name: "Stacktrace.frame.types", type: "keyword" },
        ],
        values: [["st1", "frame1,frame2", ""]],
      })
      // 3rd call: frame lookup
      .mockResolvedValueOnce({
        columns: [
          { name: "_id", type: "keyword" },
          { name: "Stackframe.function.name", type: "keyword" },
          { name: "Stackframe.file.name", type: "keyword" },
          { name: "Stackframe.line.number", type: "long" },
          { name: "Stackframe.function.offset", type: "long" },
        ],
        values: [
          ["frame1", "doWork", "worker.go", 42, 0],
          ["frame2", "main", "main.go", 10, 0],
        ],
      });

    const client = mockClient({ query: queryMock });
    const result = await fetchStacktraces(
      client,
      "FROM profiling-events-all",
      new AbortController().signal,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.stacktraceId).toBe("st1");
    expect(result[0]!.count).toBe(5);
    expect(result[0]!.frames).toHaveLength(2);
    expect(result[0]!.frames[0]!.functionName).toBe("doWork");
    expect(result[0]!.frames[1]!.functionName).toBe("main");
    expect(queryMock).toHaveBeenCalledTimes(3);
  });

  it("skips frame lookup when parsed frame IDs are empty", async () => {
    const queryMock = vi
      .fn()
      // 1st call: events query
      .mockResolvedValueOnce({
        columns: [
          { name: "@timestamp", type: "date" },
          { name: "Stacktrace.id", type: "keyword" },
          { name: "Stacktrace.count", type: "long" },
          { name: "service.name", type: "keyword" },
          { name: "host.name", type: "keyword" },
        ],
        values: [["2026-01-01T00:00:00Z", "st1", 5, "my-svc", "host-a"]],
      })
      // 2nd call: stacktrace lookup (no frame IDs)
      .mockResolvedValueOnce({
        columns: [
          { name: "_id", type: "keyword" },
          { name: "Stacktrace.frame.ids", type: "keyword" },
          { name: "Stacktrace.frame.types", type: "keyword" },
        ],
        values: [["st1", "", ""]],
      });

    const client = mockClient({ query: queryMock });
    const result = await fetchStacktraces(
      client,
      "FROM profiling-events-all",
      new AbortController().signal,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.stacktraceId).toBe("st1");
    expect(result[0]!.frames).toEqual([]);
    // events + stacktrace lookup only; frame lookup should be skipped
    expect(queryMock).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// executeProfilingRun
// ---------------------------------------------------------------------------

describe("executeProfilingRun", () => {
  it("dispatches to fetchTopFunctions for topFunctions mode", async () => {
    const client = mockClient({
      getTopFunctions: vi
        .fn()
        .mockResolvedValue([{ frame: { function_name: "entry" }, self_count: 1, total_count: 2 }]),
    });
    const result = await executeProfilingRun(
      client,
      new AbortController().signal,
      "topFunctions",
      FILTERS,
      "unused-query",
    );
    expect(result.topFunctionsRows).toHaveLength(1);
    expect(result.timelineResult).toBeNull();
    expect(result.stacktraces).toEqual([]);
  });

  it("dispatches to fetchTimeline for timeline mode", async () => {
    const response = { columns: [{ name: "ts", type: "date" }], values: [["2026-01-01"]] };
    const client = mockClient({ query: vi.fn().mockResolvedValue(response) });
    const result = await executeProfilingRun(
      client,
      new AbortController().signal,
      "timeline",
      FILTERS,
      "FROM profiling-events-all",
    );
    expect(result.topFunctionsRows).toEqual([]);
    expect(result.timelineResult).toBe(response);
    expect(result.stacktraces).toEqual([]);
  });

  it("dispatches to fetchStacktraces for stacktraces mode", async () => {
    const client = mockClient({
      query: vi.fn().mockResolvedValue({ columns: [], values: [] }),
    });
    const result = await executeProfilingRun(
      client,
      new AbortController().signal,
      "stacktraces",
      FILTERS,
      "FROM profiling-events-all",
    );
    expect(result.topFunctionsRows).toEqual([]);
    expect(result.timelineResult).toBeNull();
    expect(result.stacktraces).toEqual([]);
  });

  it("dispatches to fetchStacktraces for flamegraph mode", async () => {
    const client = mockClient({
      query: vi.fn().mockResolvedValue({ columns: [], values: [] }),
    });
    const result = await executeProfilingRun(
      client,
      new AbortController().signal,
      "flamegraph",
      FILTERS,
      "FROM profiling-events-all",
    );
    expect(result.topFunctionsRows).toEqual([]);
    expect(result.timelineResult).toBeNull();
    // flamegraph uses the same stacktrace pipeline
    expect(result.stacktraces).toEqual([]);
  });
});
