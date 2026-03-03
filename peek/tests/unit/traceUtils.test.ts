import { describe, it, expect } from "vitest";

import {
  buildSpanTree,
  flattenSpanTree,
  parseSpansFromEsql,
  parseSpanLinks,
  formatSpanDuration,
  formatStatusLabel,
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
    events: [],
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

  it("includes all spans when trace has both a natural root and a cyclic component", () => {
    const spans = [
      makeSpan({ spanId: "root", parentSpanId: null, timestamp: "2026-01-01T00:00:00.200Z" }),
      makeSpan({ spanId: "a", parentSpanId: "b", timestamp: "2026-01-01T00:00:00.000Z" }),
      makeSpan({ spanId: "b", parentSpanId: "a", timestamp: "2026-01-01T00:00:00.100Z" }),
    ];
    const roots = buildSpanTree(spans);
    const flat = flattenSpanTree(roots);
    expect(roots.map((n) => n.span.spanId)).toEqual(["a", "root"]);
    expect(flat.map((n) => n.span.spanId)).toContain("root");
    expect(flat.map((n) => n.span.spanId)).toContain("a");
    expect(flat.map((n) => n.span.spanId)).toContain("b");
    expect(flat).toHaveLength(spans.length);
  });

  it("does not keep child depth at root level when promoting disconnected cycles", () => {
    const spans = [
      makeSpan({ spanId: "root", parentSpanId: null, timestamp: "2026-01-01T00:00:00.000Z" }),
      makeSpan({ spanId: "x", parentSpanId: "y", timestamp: "2026-01-01T00:00:00.100Z" }),
      makeSpan({ spanId: "y", parentSpanId: "z", timestamp: "2026-01-01T00:00:00.200Z" }),
      makeSpan({ spanId: "z", parentSpanId: "y", timestamp: "2026-01-01T00:00:00.300Z" }),
    ];

    const roots = buildSpanTree(spans);
    const flat = flattenSpanTree(roots);
    const yIndex = flat.findIndex((node) => node.span.spanId === "y");
    const xNode = flat.find((node) => node.span.spanId === "x");
    const yNode = flat.find((node) => node.span.spanId === "y");

    expect(flat.map((node) => node.span.spanId).sort()).toEqual(["root", "x", "y", "z"]);
    expect(yIndex).toBeGreaterThanOrEqual(0);
    expect(xNode).toBeDefined();
    expect(yNode).toBeDefined();
    expect(flat.findIndex((node) => node.span.spanId === "x")).toBeGreaterThan(yIndex);
    expect(xNode!.depth).toBeGreaterThan(yNode!.depth);
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

describe("formatStatusLabel", () => {
  it('maps "OK" to "Success"', () => {
    expect(formatStatusLabel("OK")).toBe("Success");
  });

  it('maps "STATUS_CODE_OK" to "Success"', () => {
    expect(formatStatusLabel("STATUS_CODE_OK")).toBe("Success");
  });

  it("passes through other statuses unchanged", () => {
    expect(formatStatusLabel("Error")).toBe("Error");
    expect(formatStatusLabel("Unset")).toBe("Unset");
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
    durationNs: "duration_nanos",
    statusCode: "status",
    timestamp: "@timestamp",
    timestampUs: "timestamp_us",
    events: "events",
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

  it("parses span events from an array column", () => {
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
      { name: "events", type: "nested" },
    ];
    const values = [
      [
        "t1",
        "s1",
        null,
        "svc",
        "op",
        "SERVER",
        1000,
        "OK",
        "2026-01-01T00:00:00Z",
        [
          {
            name: "exception",
            "@timestamp": "2026-01-01T00:00:00.500Z",
            "exception.type": "RuntimeException",
          },
        ],
      ],
    ];

    const spans = parseSpansFromEsql(columns, values, fieldMapping);
    expect(spans[0]!.events).toHaveLength(1);
    expect(spans[0]!.events[0]!.name).toBe("exception");
    expect(spans[0]!.events[0]!.timestamp).toBe("2026-01-01T00:00:00.500Z");
    expect(spans[0]!.events[0]!.attributes).toEqual({
      "exception.type": "RuntimeException",
    });
  });

  it("parses span events from a JSON string column", () => {
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
      { name: "events", type: "keyword" },
    ];
    const eventsJson = JSON.stringify([{ name: "checkpoint", timestamp: "2026-01-01T00:00:01Z" }]);
    const values = [
      ["t1", "s1", null, "svc", "op", "SERVER", 1000, "OK", "2026-01-01T00:00:00Z", eventsJson],
    ];

    const spans = parseSpansFromEsql(columns, values, fieldMapping);
    expect(spans[0]!.events).toHaveLength(1);
    expect(spans[0]!.events[0]!.name).toBe("checkpoint");
    expect(spans[0]!.events[0]!.timestamp).toBe("2026-01-01T00:00:01Z");
  });

  it("returns empty events when events column is null", () => {
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
      { name: "events", type: "nested" },
    ];
    const values = [
      ["t1", "s1", null, "svc", "op", "SERVER", 1000, "OK", "2026-01-01T00:00:00Z", null],
    ];

    const spans = parseSpansFromEsql(columns, values, fieldMapping);
    expect(spans[0]!.events).toEqual([]);
  });

  it("returns empty events when events column is absent", () => {
    const columns = [
      { name: "trace.id", type: "keyword" },
      { name: "span.id", type: "keyword" },
    ];
    const values = [["t1", "s1"]];

    const spans = parseSpansFromEsql(columns, values, fieldMapping);
    expect(spans[0]!.events).toEqual([]);
  });

  it("excludes events column from span attributes", () => {
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
      { name: "events", type: "nested" },
    ];
    const values = [
      [
        "t1",
        "s1",
        null,
        "svc",
        "op",
        "SERVER",
        1000,
        "OK",
        "2026-01-01T00:00:00Z",
        [{ name: "ev" }],
      ],
    ];

    const spans = parseSpansFromEsql(columns, values, fieldMapping);
    expect(spans[0]!.attributes).not.toHaveProperty("events");
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

  it("parses span links from links.trace.id and links.span.id columns", () => {
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
      { name: "links.trace.id", type: "keyword" },
      { name: "links.span.id", type: "keyword" },
    ];
    const values = [
      [
        "t1",
        "s1",
        null,
        "svc",
        "op",
        "SERVER",
        1000,
        "OK",
        "2026-01-01T00:00:00Z",
        ["linked-trace-1", "linked-trace-2"],
        ["linked-span-1", "linked-span-2"],
      ],
    ];

    const spans = parseSpansFromEsql(columns, values, fieldMapping);
    expect(spans[0]!.links).toHaveLength(2);
    expect(spans[0]!.links![0]).toEqual({
      traceId: "linked-trace-1",
      spanId: "linked-span-1",
      attributes: {},
    });
    expect(spans[0]!.links![1]).toEqual({
      traceId: "linked-trace-2",
      spanId: "linked-span-2",
      attributes: {},
    });
  });

  it("excludes links columns from span attributes", () => {
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
      { name: "links.trace.id", type: "keyword" },
      { name: "links.span.id", type: "keyword" },
      { name: "http.method", type: "keyword" },
    ];
    const values = [
      [
        "t1",
        "s1",
        null,
        "svc",
        "op",
        "SERVER",
        1000,
        "OK",
        "2026-01-01T00:00:00Z",
        "lt1",
        "ls1",
        "GET",
      ],
    ];

    const spans = parseSpansFromEsql(columns, values, fieldMapping);
    expect(spans[0]!.attributes).toEqual({ "http.method": "GET" });
    expect(spans[0]!.attributes).not.toHaveProperty("links.trace.id");
    expect(spans[0]!.attributes).not.toHaveProperty("links.span.id");
  });
});

describe("parseSpanLinks", () => {
  it("returns empty array when links columns are absent", () => {
    const colIndex = new Map<string, number>([
      ["trace.id", 0],
      ["span.id", 1],
    ]);
    const row = ["t1", "s1"];
    expect(parseSpanLinks(colIndex, row)).toEqual([]);
  });

  it("returns empty array when link trace or span id is null", () => {
    const colIndex = new Map<string, number>([
      ["links.trace.id", 0],
      ["links.span.id", 1],
    ]);
    expect(parseSpanLinks(colIndex, [null, null])).toEqual([]);
    expect(parseSpanLinks(colIndex, [null, "s1"])).toEqual([]);
    expect(parseSpanLinks(colIndex, ["t1", null])).toEqual([]);
  });

  it("parses a single scalar link", () => {
    const colIndex = new Map<string, number>([
      ["links.trace.id", 0],
      ["links.span.id", 1],
    ]);
    const row = ["trace-abc", "span-xyz"];
    const links = parseSpanLinks(colIndex, row);
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({ traceId: "trace-abc", spanId: "span-xyz", attributes: {} });
  });

  it("parses multiple links from array values", () => {
    const colIndex = new Map<string, number>([
      ["links.trace.id", 0],
      ["links.span.id", 1],
    ]);
    const row = [
      ["trace-1", "trace-2"],
      ["span-1", "span-2"],
    ];
    const links = parseSpanLinks(colIndex, row);
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({ traceId: "trace-1", spanId: "span-1", attributes: {} });
    expect(links[1]).toEqual({ traceId: "trace-2", spanId: "span-2", attributes: {} });
  });

  it("zips link attributes with corresponding links", () => {
    const colIndex = new Map<string, number>([
      ["links.trace.id", 0],
      ["links.span.id", 1],
      ["links.attributes.messaging.system", 2],
    ]);
    const row = [
      ["t1", "t2"],
      ["s1", "s2"],
      ["kafka", "rabbitmq"],
    ];
    const links = parseSpanLinks(colIndex, row);
    expect(links[0]!.attributes).toEqual({ "messaging.system": "kafka" });
    expect(links[1]!.attributes).toEqual({ "messaging.system": "rabbitmq" });
  });

  it("skips links where traceId or spanId array element is null", () => {
    const colIndex = new Map<string, number>([
      ["links.trace.id", 0],
      ["links.span.id", 1],
    ]);
    const row = [
      ["t1", null],
      ["s1", "s2"],
    ];
    const links = parseSpanLinks(colIndex, row);
    expect(links).toHaveLength(1);
    expect(links[0]!.traceId).toBe("t1");
  });

  it("truncates to the shorter of traceIds/spanIds arrays", () => {
    const colIndex = new Map<string, number>([
      ["links.trace.id", 0],
      ["links.span.id", 1],
    ]);
    const row = [["t1", "t2", "t3"], ["s1"]];
    const links = parseSpanLinks(colIndex, row);
    expect(links).toHaveLength(1);
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
