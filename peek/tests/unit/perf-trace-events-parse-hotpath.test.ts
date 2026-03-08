import { describe, expect, it } from "vitest";

import { parseSpansFromEsql } from "../../src/components/traces/traceUtils";

const ROW_COUNT = 10_000;
const ITERATIONS = 20;

const columns = [
  { name: "trace.id", type: "keyword" },
  { name: "span.id", type: "keyword" },
  { name: "parent.id", type: "keyword" },
  { name: "name", type: "keyword" },
  { name: "service.name", type: "keyword" },
  { name: "kind", type: "keyword" },
  { name: "status", type: "keyword" },
  { name: "@timestamp", type: "date" },
  { name: "duration", type: "long" },
  { name: "events", type: "keyword" },
];

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

/**
 * Build rows whose `events` column exercises the fast-path guards
 * (empty-array strings and non-array strings).
 */
function generateRows(rowCount: number): unknown[][] {
  const rows: unknown[][] = [];
  for (let i = 0; i < rowCount; i++) {
    const eventsValue = i % 3 === 0 ? "[]" : i % 3 === 1 ? "not-json" : "  []  ";
    rows.push([
      `trace-${i}`,
      `span-${i}`,
      i > 0 ? `span-${i - 1}` : null,
      `op-${i}`,
      "test-svc",
      "INTERNAL",
      "OK",
      "2025-01-01T00:00:00.000Z",
      1000,
      eventsValue,
    ]);
  }
  return rows;
}

describe("parseSpanEvents hot-path performance", () => {
  it("parses trace events within performance budget", () => {
    const rows = generateRows(ROW_COUNT);
    const timings: number[] = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      parseSpansFromEsql(columns, rows, fieldMapping);
      timings.push(performance.now() - start);
    }

    timings.sort((a, b) => a - b);
    const median = timings[Math.floor(timings.length / 2)];
    const avg = timings.reduce((a, b) => a + b, 0) / timings.length;

    console.log(`PERF_TRACE_EVENTS_MEDIAN_MS=${median.toFixed(2)}`);
    console.log(`PERF_TRACE_EVENTS_AVG_MS=${avg.toFixed(2)}`);

    // Median should be well under 200ms for 10k rows of fast-path payloads
    expect(median).toBeLessThan(200);
  });
});
