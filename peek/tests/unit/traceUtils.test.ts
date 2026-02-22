import { describe, it, expect } from "vitest";

import {
  buildSpanTree,
  flattenSpanTree,
  parseSpansFromEsql,
  formatSpanDuration,
  getTraceTimeBounds,
  buildServiceMapData,
} from "../../src/components/traces/traceUtils";
import type { Span } from "../../src/components/traces/traceUtils";

function makeSpan(overrides: Partial<Span> = {}): Span {
  const timestamp = overrides.timestamp ?? "2026-01-01T00:00:00.000Z";
  return {
    traceId: "trace-1",
    spanId: "span-1",
    parentSpanId: null,
    serviceName: "test-service",
    name: "test-op",
    kind: "SERVER",
    durationUs: 1000,
    status: "OK",
    timestamp,
    startTimeUs: new Date(timestamp).getTime() * 1000,
    attributes: {},
    ...overrides,
  };
}

describe("buildSpanTree", () => {
  it("returns a single root when there is one span", () => {
    const spans = [makeSpan({ spanId: "a" })];
    const roots = buildSpanTree(spans);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.span.spanId).toBe("a");
    expect(roots[0]!.children).toHaveLength(0);
    expect(roots[0]!.depth).toBe(0);
  });

  it("builds a parent-child tree", () => {
    const spans = [
      makeSpan({ spanId: "root", parentSpanId: null, timestamp: "2026-01-01T00:00:00.000Z" }),
      makeSpan({
        spanId: "child-1",
        parentSpanId: "root",
        timestamp: "2026-01-01T00:00:00.100Z",
      }),
      makeSpan({
        spanId: "child-2",
        parentSpanId: "root",
        timestamp: "2026-01-01T00:00:00.200Z",
      }),
    ];
    const roots = buildSpanTree(spans);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.children).toHaveLength(2);
    expect(roots[0]!.children[0]!.span.spanId).toBe("child-1");
    expect(roots[0]!.children[1]!.span.spanId).toBe("child-2");
  });

  it("assigns correct depths", () => {
    const spans = [
      makeSpan({ spanId: "root", parentSpanId: null }),
      makeSpan({ spanId: "child", parentSpanId: "root" }),
      makeSpan({ spanId: "grandchild", parentSpanId: "child" }),
    ];
    const roots = buildSpanTree(spans);
    const flat = flattenSpanTree(roots);
    expect(flat[0]!.depth).toBe(0);
    expect(flat[1]!.depth).toBe(1);
    expect(flat[2]!.depth).toBe(2);
  });

  it("treats orphan spans as roots", () => {
    const spans = [
      makeSpan({ spanId: "a", parentSpanId: null }),
      makeSpan({ spanId: "b", parentSpanId: "missing-parent" }),
    ];
    const roots = buildSpanTree(spans);
    expect(roots).toHaveLength(2);
  });

  it("handles self-referencing span without infinite loop", () => {
    const spans = [
      makeSpan({ spanId: "root", parentSpanId: null }),
      makeSpan({ spanId: "self", parentSpanId: "self" }),
    ];
    // "self" references itself — should not hang or crash
    const roots = buildSpanTree(spans);
    const flat = flattenSpanTree(roots);
    // "root" is a proper root, "self" references itself so byId.has("self")
    // is true and it gets attached as its own child, not as a root
    expect(flat.length).toBeGreaterThanOrEqual(1);
    expect(flat[0]!.span.spanId).toBe("root");
  });

  it("seeds a fallback root when all spans are in a cycle", () => {
    const spans = [
      makeSpan({
        spanId: "a",
        parentSpanId: "b",
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
      makeSpan({
        spanId: "b",
        parentSpanId: "a",
        timestamp: "2026-01-01T00:00:00.100Z",
      }),
    ];
    const roots = buildSpanTree(spans);
    const flat = flattenSpanTree(roots);
    expect(roots).toHaveLength(1);
    // Earliest span is chosen as synthetic root.
    expect(roots[0]!.span.spanId).toBe("a");
    expect(flat.map((n) => n.span.spanId)).toEqual(["a", "b"]);
    expect(flat[0]!.depth).toBe(0);
    expect(flat[1]!.depth).toBe(1);
  });

  it("seeds fallback root for a self-cycle with no natural root", () => {
    const spans = [makeSpan({ spanId: "self", parentSpanId: "self" })];
    const roots = buildSpanTree(spans);
    const flat = flattenSpanTree(roots);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.span.spanId).toBe("self");
    expect(flat.map((n) => n.span.spanId)).toEqual(["self"]);
    expect(flat[0]!.depth).toBe(0);
  });

  it("handles a three-node cycle without collapsing to empty", () => {
    const spans = [
      makeSpan({ spanId: "a", parentSpanId: "c", timestamp: "2026-01-01T00:00:00.000Z" }),
      makeSpan({ spanId: "b", parentSpanId: "a", timestamp: "2026-01-01T00:00:00.100Z" }),
      makeSpan({ spanId: "c", parentSpanId: "b", timestamp: "2026-01-01T00:00:00.200Z" }),
    ];
    const roots = buildSpanTree(spans);
    const flat = flattenSpanTree(roots);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.span.spanId).toBe("a");
    expect(flat.map((n) => n.span.spanId)).toEqual(["a", "b", "c"]);
  });

  it("sorts children chronologically", () => {
    const spans = [
      makeSpan({ spanId: "root", parentSpanId: null, timestamp: "2026-01-01T00:00:00.000Z" }),
      makeSpan({
        spanId: "late",
        parentSpanId: "root",
        timestamp: "2026-01-01T00:00:01.000Z",
      }),
      makeSpan({
        spanId: "early",
        parentSpanId: "root",
        timestamp: "2026-01-01T00:00:00.100Z",
      }),
    ];
    const roots = buildSpanTree(spans);
    expect(roots[0]!.children[0]!.span.spanId).toBe("early");
    expect(roots[0]!.children[1]!.span.spanId).toBe("late");
  });
});

describe("flattenSpanTree", () => {
  it("returns nodes in DFS order", () => {
    const spans = [
      makeSpan({ spanId: "root", parentSpanId: null, timestamp: "2026-01-01T00:00:00.000Z" }),
      makeSpan({
        spanId: "child-1",
        parentSpanId: "root",
        timestamp: "2026-01-01T00:00:00.100Z",
      }),
      makeSpan({
        spanId: "grandchild",
        parentSpanId: "child-1",
        timestamp: "2026-01-01T00:00:00.200Z",
      }),
      makeSpan({
        spanId: "child-2",
        parentSpanId: "root",
        timestamp: "2026-01-01T00:00:00.300Z",
      }),
    ];
    const roots = buildSpanTree(spans);
    const flat = flattenSpanTree(roots);
    expect(flat.map((n) => n.span.spanId)).toEqual(["root", "child-1", "grandchild", "child-2"]);
  });

  it("returns empty array for empty input", () => {
    expect(flattenSpanTree([])).toEqual([]);
  });
});

describe("formatSpanDuration", () => {
  it("formats zero duration", () => {
    expect(formatSpanDuration(0)).toBe("0µs");
  });

  it("formats microseconds", () => {
    expect(formatSpanDuration(500)).toBe("500µs");
  });

  it("formats milliseconds", () => {
    expect(formatSpanDuration(1500)).toBe("1.5ms");
  });

  it("formats large milliseconds without decimal", () => {
    expect(formatSpanDuration(15000)).toBe("15ms");
  });

  it("formats seconds", () => {
    expect(formatSpanDuration(1_500_000)).toBe("1.5s");
  });

  it("formats large seconds without decimal", () => {
    expect(formatSpanDuration(15_000_000)).toBe("15s");
  });
});

describe("getTraceTimeBounds", () => {
  it("returns zeroes for empty input", () => {
    expect(getTraceTimeBounds([])).toEqual({ startUs: 0, endUs: 0 });
  });

  it("calculates correct bounds", () => {
    const spans = [
      makeSpan({
        timestamp: "2026-01-01T00:00:00.000Z",
        durationUs: 1_000_000,
      }),
      makeSpan({
        timestamp: "2026-01-01T00:00:01.000Z",
        durationUs: 500_000,
      }),
    ];
    const { startUs, endUs } = getTraceTimeBounds(spans);
    const expectedStart = new Date("2026-01-01T00:00:00.000Z").getTime() * 1000;
    const expectedEnd = new Date("2026-01-01T00:00:01.000Z").getTime() * 1000 + 500_000;
    expect(startUs).toBe(expectedStart);
    expect(endUs).toBe(expectedEnd);
  });
});

describe("parseSpansFromEsql", () => {
  const fieldMapping = {
    traceId: "trace.id",
    spanId: "span.id",
    parentSpanId: "parent.id",
    serviceName: "service.name",
    spanName: "name",
    spanKind: "kind",
    durationUs: "duration",
    statusCode: "status",
    timestamp: "@timestamp",
  };

  it("parses rows into Span objects", () => {
    const columns = [
      { name: "trace.id", type: "keyword" },
      { name: "span.id", type: "keyword" },
      { name: "parent.id", type: "keyword" },
      { name: "service.name", type: "keyword" },
      { name: "name", type: "keyword" },
      { name: "kind", type: "keyword" },
      { name: "duration", type: "long" },
      { name: "status", type: "keyword" },
      { name: "@timestamp", type: "date" },
      { name: "http.method", type: "keyword" },
    ];
    const values = [
      [
        "t1",
        "s1",
        null,
        "api-gw",
        "GET /users",
        "SERVER",
        1500000,
        "OK",
        "2026-01-01T00:00:00Z",
        "GET",
      ],
    ];

    const spans = parseSpansFromEsql(columns, values, fieldMapping);
    expect(spans).toHaveLength(1);
    expect(spans[0]!.traceId).toBe("t1");
    expect(spans[0]!.spanId).toBe("s1");
    expect(spans[0]!.parentSpanId).toBeNull();
    expect(spans[0]!.serviceName).toBe("api-gw");
    expect(spans[0]!.name).toBe("GET /users");
    expect(spans[0]!.durationUs).toBe(1500000);
    expect(spans[0]!.attributes).toEqual({ "http.method": "GET" });
  });

  it("excludes null attribute values from span attributes", () => {
    const columns = [
      { name: "trace.id", type: "keyword" },
      { name: "span.id", type: "keyword" },
      { name: "parent.id", type: "keyword" },
      { name: "service.name", type: "keyword" },
      { name: "name", type: "keyword" },
      { name: "kind", type: "keyword" },
      { name: "duration", type: "long" },
      { name: "status", type: "keyword" },
      { name: "@timestamp", type: "date" },
      { name: "http.method", type: "keyword" },
      { name: "http.url", type: "keyword" },
    ];
    const values = [
      ["t1", "s1", null, "svc", "op", "SERVER", 1000, "OK", "2026-01-01T00:00:00Z", "GET", null],
    ];

    const spans = parseSpansFromEsql(columns, values, fieldMapping);
    // http.url is null so it should not appear in attributes
    expect(spans[0]!.attributes).toEqual({ "http.method": "GET" });
    expect(spans[0]!.attributes).not.toHaveProperty("http.url");
  });

  it("handles missing fields gracefully", () => {
    const columns = [
      { name: "trace.id", type: "keyword" },
      { name: "span.id", type: "keyword" },
    ];
    const values = [["t1", "s1"]];

    const spans = parseSpansFromEsql(columns, values, fieldMapping);
    expect(spans).toHaveLength(1);
    expect(spans[0]!.serviceName).toBe("unknown");
    expect(spans[0]!.durationUs).toBe(0);
  });
});

describe("buildServiceMapData", () => {
  it("builds service nodes and cross-service edges from parent/child spans", () => {
    const spans = [
      makeSpan({ spanId: "root", serviceName: "frontend", parentSpanId: null }),
      makeSpan({ spanId: "api", serviceName: "api", parentSpanId: "root" }),
      makeSpan({ spanId: "db", serviceName: "db", parentSpanId: "api" }),
    ];

    const map = buildServiceMapData(spans);
    expect(map.nodes.map((n) => n.serviceName).sort()).toEqual(["api", "db", "frontend"]);
    expect(map.edges).toEqual([
      { source: "frontend", target: "api", callCount: 1, errorCount: 0, totalDurationUs: 1000 },
      { source: "api", target: "db", callCount: 1, errorCount: 0, totalDurationUs: 1000 },
    ]);
  });

  it("aggregates repeated edges and ignores same-service calls", () => {
    const spans = [
      makeSpan({ spanId: "root", serviceName: "frontend", parentSpanId: null }),
      makeSpan({ spanId: "child-1", serviceName: "api", parentSpanId: "root", status: "Error" }),
      makeSpan({ spanId: "child-2", serviceName: "api", parentSpanId: "root" }),
      makeSpan({ spanId: "child-3", serviceName: "api", parentSpanId: "child-1" }),
    ];

    const map = buildServiceMapData(spans);
    expect(map.edges).toEqual([
      {
        source: "frontend",
        target: "api",
        callCount: 2,
        errorCount: 1,
        totalDurationUs: 2000,
      },
    ]);
  });
});
