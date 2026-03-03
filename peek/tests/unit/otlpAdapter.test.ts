import { describe, it, expect } from "vitest";

import { spansToOtlpTracesData } from "../../src/components/traces/otlpAdapter";
import type { Span } from "../../src/components/traces/traceUtils";

function makeSpan(overrides: Partial<Span> = {}): Span {
  return {
    traceId: "trace1",
    spanId: "span1",
    parentSpanId: null,
    serviceName: "my-service",
    name: "GET /api",
    kind: "SERVER",
    durationUs: 5000,
    status: "OK",
    timestamp: "2024-01-01T00:00:00.000Z",
    startTimeUs: 1_000_000,
    attributes: {},
    ...overrides,
  };
}

describe("spansToOtlpTracesData", () => {
  it("returns empty resourceSpans for an empty span array", () => {
    const result = spansToOtlpTracesData([]);
    expect(result.resourceSpans).toEqual([]);
  });

  it("converts a single span to OTLP format", () => {
    const result = spansToOtlpTracesData([makeSpan()]);
    expect(result.resourceSpans).toHaveLength(1);

    const rs = result.resourceSpans[0]!;
    expect(rs.resource?.attributes).toEqual([
      { key: "service.name", value: { stringValue: "my-service" } },
    ]);
    expect(rs.scopeSpans).toHaveLength(1);
    expect(rs.scopeSpans[0]!.spans).toHaveLength(1);

    const span = rs.scopeSpans[0]!.spans[0]!;
    expect(span.traceId).toBe("trace1");
    expect(span.spanId).toBe("span1");
    expect(span.parentSpanId).toBeUndefined();
    expect(span.name).toBe("GET /api");
    expect(span.kind).toBe("SERVER");
  });

  it("converts time from microseconds to nanosecond strings", () => {
    const result = spansToOtlpTracesData([makeSpan({ startTimeUs: 1_000_000, durationUs: 5000 })]);
    const span = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
    // 1_000_000 us * 1000 = 1_000_000_000 ns
    expect(span.startTimeUnixNano).toBe("1000000000");
    // (1_000_000 + 5000) us * 1000 = 1_005_000_000 ns
    expect(span.endTimeUnixNano).toBe("1005000000");
  });

  it("keeps epoch-scale nanosecond strings exact", () => {
    const result = spansToOtlpTracesData([
      makeSpan({ startTimeUs: 1_700_000_000_000_123, durationUs: 7 }),
    ]);
    const span = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
    expect(span.startTimeUnixNano).toBe("1700000000000123000");
    expect(span.endTimeUnixNano).toBe("1700000000000130000");
  });

  it("falls back to zero nanoseconds for non-finite microsecond timestamps", () => {
    const result = spansToOtlpTracesData([makeSpan({ startTimeUs: Number.NaN, durationUs: 5 })]);
    const span = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
    expect(span.startTimeUnixNano).toBe("0");
    expect(span.endTimeUnixNano).toBe("0");
  });

  it("groups spans by service into separate ResourceSpans", () => {
    const result = spansToOtlpTracesData([
      makeSpan({ spanId: "a", serviceName: "svc-a" }),
      makeSpan({ spanId: "b", serviceName: "svc-b" }),
      makeSpan({ spanId: "c", serviceName: "svc-a" }),
    ]);
    expect(result.resourceSpans).toHaveLength(2);

    const svcA = result.resourceSpans.find(
      (rs) =>
        rs.resource?.attributes?.[0]?.value &&
        "stringValue" in rs.resource.attributes[0].value &&
        rs.resource.attributes[0].value.stringValue === "svc-a",
    );
    const svcB = result.resourceSpans.find(
      (rs) =>
        rs.resource?.attributes?.[0]?.value &&
        "stringValue" in rs.resource.attributes[0].value &&
        rs.resource.attributes[0].value.stringValue === "svc-b",
    );
    expect(svcA!.scopeSpans[0]!.spans).toHaveLength(2);
    expect(svcB!.scopeSpans[0]!.spans).toHaveLength(1);
  });

  it("converts attributes to OTLP KeyValue format", () => {
    const result = spansToOtlpTracesData([
      makeSpan({
        attributes: {
          "http.method": "GET",
          "http.status_code": 200,
          "http.ok": true,
          "latency.p99": 12.5,
        },
      }),
    ]);
    const attrs = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.attributes!;

    expect(attrs).toContainEqual({ key: "http.method", value: { stringValue: "GET" } });
    expect(attrs).toContainEqual({ key: "http.status_code", value: { intValue: "200" } });
    expect(attrs).toContainEqual({ key: "http.ok", value: { boolValue: true } });
    expect(attrs).toContainEqual({ key: "latency.p99", value: { doubleValue: 12.5 } });
  });

  it("maps status strings to OTLP status codes", () => {
    const cases: Array<{ input: string; expected: string }> = [
      { input: "OK", expected: "STATUS_CODE_OK" },
      { input: "STATUS_CODE_OK", expected: "STATUS_CODE_OK" },
      { input: "Error", expected: "STATUS_CODE_ERROR" },
      { input: "STATUS_CODE_ERROR", expected: "STATUS_CODE_ERROR" },
      { input: "UNKNOWN", expected: "STATUS_CODE_UNSET" },
    ];
    for (const { input, expected } of cases) {
      const result = spansToOtlpTracesData([makeSpan({ status: input })]);
      const span = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
      expect(span.status?.code).toBe(expected);
    }
  });

  it("converts parentSpanId null to undefined", () => {
    const result = spansToOtlpTracesData([makeSpan({ parentSpanId: null })]);
    const span = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
    expect(span.parentSpanId).toBeUndefined();
  });

  it("preserves parentSpanId when set", () => {
    const result = spansToOtlpTracesData([makeSpan({ parentSpanId: "parent1" })]);
    const span = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
    expect(span.parentSpanId).toBe("parent1");
  });

  it("converts events to OTLP format", () => {
    const result = spansToOtlpTracesData([
      makeSpan({
        events: [
          {
            name: "exception",
            timestamp: "2024-01-01T00:00:01.000Z",
            attributes: { "exception.message": "boom" },
          },
        ],
      }),
    ]);
    const events = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.events!;
    expect(events).toHaveLength(1);
    expect(events[0]!.name).toBe("exception");
    expect(events[0]!.attributes).toContainEqual({
      key: "exception.message",
      value: { stringValue: "boom" },
    });
  });

  it("converts links to OTLP format", () => {
    const result = spansToOtlpTracesData([
      makeSpan({
        links: [{ traceId: "linked-trace", spanId: "linked-span", attributes: { key: "val" } }],
      }),
    ]);
    const links = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.links!;
    expect(links).toHaveLength(1);
    expect(links[0]!.traceId).toBe("linked-trace");
    expect(links[0]!.spanId).toBe("linked-span");
    expect(links[0]!.attributes).toContainEqual({ key: "key", value: { stringValue: "val" } });
  });

  it("handles array attribute values", () => {
    const result = spansToOtlpTracesData([makeSpan({ attributes: { tags: ["a", "b"] } })]);
    const attrs = result.resourceSpans[0]!.scopeSpans[0]!.spans[0]!.attributes!;
    expect(attrs).toContainEqual({
      key: "tags",
      value: { arrayValue: { values: [{ stringValue: "a" }, { stringValue: "b" }] } },
    });
  });
});
