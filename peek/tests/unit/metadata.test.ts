import { describe, it, expect, vi } from "vitest";

import {
  classifyMetricType,
  isDimensionField,
  listFields,
  getFieldValues,
  getFieldCardinality,
} from "../../src/services/es/metadata";
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

describe("isDimensionField", () => {
  it("accepts keyword fields", () => {
    expect(isDimensionField({ name: "host.name", type: "keyword", metricType: "unknown" })).toBe(
      true,
    );
  });

  it("accepts ip fields", () => {
    expect(isDimensionField({ name: "source.ip", type: "ip", metricType: "unknown" })).toBe(true);
  });

  it("rejects gauge metric fields", () => {
    expect(isDimensionField({ name: "cpu.pct", type: "double", metricType: "gauge" })).toBe(false);
  });

  it("rejects counter metric fields", () => {
    expect(
      isDimensionField({ name: "bytes.total", type: "counter_long", metricType: "counter" }),
    ).toBe(false);
  });

  it("rejects date fields", () => {
    expect(isDimensionField({ name: "event.created", type: "date", metricType: "unknown" })).toBe(
      false,
    );
  });

  it("rejects date_nanos fields", () => {
    expect(
      isDimensionField({ name: "event.created", type: "date_nanos", metricType: "unknown" }),
    ).toBe(false);
  });

  it("rejects @timestamp even when type is dimension-eligible", () => {
    expect(isDimensionField({ name: "@timestamp", type: "keyword", metricType: "unknown" })).toBe(
      false,
    );
  });

  it("rejects histogram fields", () => {
    expect(
      isDimensionField({
        name: "transaction.duration.histogram",
        type: "histogram",
        metricType: "unknown",
      }),
    ).toBe(false);
  });

  it("rejects summary fields", () => {
    expect(
      isDimensionField({
        name: "transaction.duration.summary",
        type: "summary",
        metricType: "unknown",
      }),
    ).toBe(false);
  });

  it("rejects unsupported fields", () => {
    expect(
      isDimensionField({
        name: "event.success_count",
        type: "unsupported",
        metricType: "unknown",
      }),
    ).toBe(false);
  });
});

function makeMockClient(queryFn: ElasticsearchClient["query"]): ElasticsearchClient {
  return { query: queryFn } as unknown as ElasticsearchClient;
}

describe("listFields", () => {
  it("returns fields from LIMIT 0 response", async () => {
    const client = makeMockClient(
      vi.fn().mockResolvedValue({
        columns: [
          { name: "system.cpu.total.pct", type: "double" },
          { name: "@timestamp", type: "date" },
          { name: "host.name", type: "keyword" },
        ],
        values: [],
      }),
    );

    const fields = await listFields(client, "metrics-*");

    expect(fields).toEqual([
      { name: "system.cpu.total.pct", type: "double", metricType: "gauge" },
      { name: "@timestamp", type: "date", metricType: "unknown" },
      { name: "host.name", type: "keyword", metricType: "unknown" },
    ]);
  });

  it("falls back to LIMIT 1 when LIMIT 0 returns no columns", async () => {
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ columns: [], values: [] })
      .mockResolvedValueOnce({
        columns: [{ name: "metric.name", type: "counter_long" }],
        values: [[42]],
      });

    const client = makeMockClient(queryFn);
    const fields = await listFields(client, "metrics-*");

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(fields).toEqual([{ name: "metric.name", type: "counter_long", metricType: "counter" }]);
  });

  it("passes signal through to client.query", async () => {
    const controller = new AbortController();
    const queryFn = vi.fn().mockResolvedValue({ columns: [], values: [] });
    const client = makeMockClient(queryFn);

    await listFields(client, "metrics-*", controller.signal);

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(queryFn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ query: expect.any(String) }),
      controller.signal,
    );
    expect(queryFn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ query: expect.any(String) }),
      controller.signal,
    );
  });

  it("rejects unsafe index patterns", async () => {
    const queryFn = vi.fn();
    const client = makeMockClient(queryFn);
    await expect(listFields(client, 'metrics-* | DROP TABLE "x"')).rejects.toThrow(
      "Invalid index pattern",
    );
    expect(queryFn).not.toHaveBeenCalled();
  });
});

describe("getFieldValues", () => {
  it("returns top-N values with counts", async () => {
    const client = makeMockClient(
      vi.fn().mockResolvedValue({
        columns: [
          { name: "count", type: "long" },
          { name: "host.name", type: "keyword" },
        ],
        values: [
          [100, "web-01"],
          [80, "web-02"],
          [50, "web-03"],
        ],
      }),
    );

    const result = await getFieldValues(client, "metrics-*", "host.name", 10);

    expect(result).toEqual([
      { value: "web-01", count: 100 },
      { value: "web-02", count: 80 },
      { value: "web-03", count: 50 },
    ]);
  });

  it("filters out null values", async () => {
    const client = makeMockClient(
      vi.fn().mockResolvedValue({
        columns: [
          { name: "count", type: "long" },
          { name: "host.name", type: "keyword" },
        ],
        values: [
          [100, "web-01"],
          [50, null],
        ],
      }),
    );

    const result = await getFieldValues(client, "metrics-*", "host.name");

    expect(result).toEqual([{ value: "web-01", count: 100 }]);
  });

  it("returns empty array when columns are missing", async () => {
    const client = makeMockClient(
      vi.fn().mockResolvedValue({
        columns: [{ name: "other", type: "keyword" }],
        values: [],
      }),
    );

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

  it("rejects non-positive limits", async () => {
    const queryFn = vi.fn();
    const client = makeMockClient(queryFn);
    await expect(getFieldValues(client, "metrics-*", "host.name", 0)).rejects.toThrow(
      "Invalid limit",
    );
    await expect(getFieldValues(client, "metrics-*", "host.name", -1)).rejects.toThrow(
      "Invalid limit",
    );
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("caps large limits to a safe maximum", async () => {
    const queryFn = vi.fn().mockResolvedValue({ columns: [], values: [] });
    const client = makeMockClient(queryFn);
    await getFieldValues(client, "metrics-*", "host.name", 5000);
    expect(queryFn).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringMatching(/\bLIMIT 1000\b/),
      }),
      undefined,
    );
  });

  it("rejects unsafe index patterns", async () => {
    const queryFn = vi.fn();
    const client = makeMockClient(queryFn);
    await expect(getFieldValues(client, 'metrics-* | DROP TABLE "x"', "host.name")).rejects.toThrow(
      "Invalid index pattern",
    );
    expect(queryFn).not.toHaveBeenCalled();
  });
});

describe("getFieldCardinality", () => {
  it("returns cardinality for multiple fields", async () => {
    const client = makeMockClient(
      vi.fn().mockResolvedValue({
        columns: [
          { name: "host.name_card", type: "long" },
          { name: "service.name_card", type: "long" },
        ],
        values: [[42, 5]],
      }),
    );

    const result = await getFieldCardinality(client, "metrics-*", ["host.name", "service.name"]);

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

  it("rejects unsafe index patterns", async () => {
    const queryFn = vi.fn();
    const client = makeMockClient(queryFn);
    await expect(
      getFieldCardinality(client, 'metrics-* | DROP TABLE "x"', ["host.name"]),
    ).rejects.toThrow("Invalid index pattern");
    expect(queryFn).not.toHaveBeenCalled();
  });
});
