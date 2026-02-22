import { describe, it, expect, vi } from "vitest";
import { classifyMetricType, listFields, getFieldValues, getFieldCardinality } from "../../src/services/es/metadata";
import type { ElasticsearchClient } from "../../src/services/es/client";

describe("classifyMetricType", () => {
  it("classifies counter types", () => {
    expect(classifyMetricType("counter_long")).toBe("counter");
    expect(classifyMetricType("counter_double")).toBe("counter");
    expect(classifyMetricType("counter_integer")).toBe("counter");
  });

  it("classifies gauge types", () => {
    expect(classifyMetricType("long")).toBe("gauge");
    expect(classifyMetricType("integer")).toBe("gauge");
    expect(classifyMetricType("double")).toBe("gauge");
    expect(classifyMetricType("float")).toBe("gauge");
    expect(classifyMetricType("short")).toBe("gauge");
    expect(classifyMetricType("byte")).toBe("gauge");
    expect(classifyMetricType("half_float")).toBe("gauge");
    expect(classifyMetricType("scaled_float")).toBe("gauge");
    expect(classifyMetricType("unsigned_long")).toBe("gauge");
    expect(classifyMetricType("aggregate_metric_double")).toBe("gauge");
  });

  it("classifies unknown types", () => {
    expect(classifyMetricType("keyword")).toBe("unknown");
    expect(classifyMetricType("text")).toBe("unknown");
    expect(classifyMetricType("date")).toBe("unknown");
    expect(classifyMetricType("boolean")).toBe("unknown");
    expect(classifyMetricType("ip")).toBe("unknown");
  });
});

function makeMockClient(queryFn: ElasticsearchClient["query"]): ElasticsearchClient {
  return { query: queryFn } as unknown as ElasticsearchClient;
}

describe("listFields", () => {
  it("returns fields from LIMIT 0 response", async () => {
    const client = makeMockClient(vi.fn().mockResolvedValue({
      columns: [
        { name: "system.cpu.total.pct", type: "double" },
        { name: "@timestamp", type: "date" },
        { name: "host.name", type: "keyword" },
      ],
      values: [],
    }));

    const fields = await listFields(client, "metrics-*");

    expect(fields).toEqual([
      { name: "system.cpu.total.pct", type: "double", metricType: "gauge" },
      { name: "@timestamp", type: "date", metricType: "unknown" },
      { name: "host.name", type: "keyword", metricType: "unknown" },
    ]);
  });

  it("falls back to LIMIT 1 when LIMIT 0 returns no columns", async () => {
    const queryFn = vi.fn()
      .mockResolvedValueOnce({ columns: [], values: [] })
      .mockResolvedValueOnce({
        columns: [
          { name: "metric.name", type: "counter_long" },
        ],
        values: [[42]],
      });

    const client = makeMockClient(queryFn);
    const fields = await listFields(client, "metrics-*");

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(fields).toEqual([
      { name: "metric.name", type: "counter_long", metricType: "counter" },
    ]);
  });

  it("passes signal through to client.query", async () => {
    const controller = new AbortController();
    const queryFn = vi.fn().mockResolvedValue({ columns: [], values: [] });
    const client = makeMockClient(queryFn);

    await listFields(client, "metrics-*", controller.signal);

    expect(queryFn).toHaveBeenCalledWith(
      expect.anything(),
      controller.signal,
    );
  });
});

describe("getFieldValues", () => {
  it("returns top-N values with counts", async () => {
    const client = makeMockClient(vi.fn().mockResolvedValue({
      columns: [
        { name: "count", type: "long" },
        { name: "host.name", type: "keyword" },
      ],
      values: [
        [100, "web-01"],
        [80, "web-02"],
        [50, "web-03"],
      ],
    }));

    const result = await getFieldValues(client, "metrics-*", "host.name", 10);

    expect(result).toEqual([
      { value: "web-01", count: 100 },
      { value: "web-02", count: 80 },
      { value: "web-03", count: 50 },
    ]);
  });

  it("filters out null values", async () => {
    const client = makeMockClient(vi.fn().mockResolvedValue({
      columns: [
        { name: "count", type: "long" },
        { name: "host.name", type: "keyword" },
      ],
      values: [
        [100, "web-01"],
        [50, null],
      ],
    }));

    const result = await getFieldValues(client, "metrics-*", "host.name");

    expect(result).toEqual([{ value: "web-01", count: 100 }]);
  });

  it("returns empty array when columns are missing", async () => {
    const client = makeMockClient(vi.fn().mockResolvedValue({
      columns: [{ name: "other", type: "keyword" }],
      values: [],
    }));

    const result = await getFieldValues(client, "metrics-*", "host.name");
    expect(result).toEqual([]);
  });

  it("escapes field identifiers in the generated ES|QL", async () => {
    const queryFn = vi.fn().mockResolvedValue({
      columns: [
        { name: "count", type: "long" },
        { name: "host.name", type: "keyword" },
      ],
      values: [[10, "web-01"]],
    });
    const client = makeMockClient(queryFn);

    await getFieldValues(client, "metrics-*", "host.name");

    expect(queryFn).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("BY `host.name`"),
      }),
      undefined,
    );
  });
});

describe("getFieldCardinality", () => {
  it("returns cardinality for multiple fields", async () => {
    const client = makeMockClient(vi.fn().mockResolvedValue({
      columns: [
        { name: "host.name_card", type: "long" },
        { name: "service.name_card", type: "long" },
      ],
      values: [[42, 5]],
    }));

    const result = await getFieldCardinality(client, "metrics-*", [
      "host.name",
      "service.name",
    ]);

    expect(result).toEqual({ "host.name": 42, "service.name": 5 });
  });

  it("returns empty object for empty fields array", async () => {
    const queryFn = vi.fn();
    const client = makeMockClient(queryFn);

    const result = await getFieldCardinality(client, "metrics-*", []);

    expect(result).toEqual({});
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("escapes field names in COUNT_DISTINCT expressions", async () => {
    const queryFn = vi.fn().mockResolvedValue({
      columns: [{ name: "host.name_card", type: "long" }],
      values: [[42]],
    });
    const client = makeMockClient(queryFn);

    await getFieldCardinality(client, "metrics-*", ["host.name"]);

    expect(queryFn).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("`host.name_card` = COUNT_DISTINCT(`host.name`)"),
      }),
      undefined,
    );
  });
});
