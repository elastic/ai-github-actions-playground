import { describe, expect, it } from "vitest";

import {
  toBarChartData,
  toGaugeData,
  toStatData,
  toTimeSeriesData,
} from "../../src/services/perses/dataTransformers";
import type { EsqlResponse } from "../../src/types";

describe("perses data transformers", () => {
  it("converts ES|QL rows to grouped Perses time series data", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "@timestamp", type: "date" },
        { name: "host", type: "keyword" },
        { name: "cpu", type: "double" },
        { name: "memory", type: "long" },
      ],
      values: [
        ["2026-01-01T00:00:00.000Z", "api-1", 0.5, 200],
        ["2026-01-01T00:01:00.000Z", "api-1", 0.7, 220],
        ["2026-01-01T00:00:00.000Z", "api-2", 0.8, 260],
      ],
    };

    const transformed = toTimeSeriesData(data);

    const t0 = Date.parse("2026-01-01T00:00:00.000Z");
    const t1 = Date.parse("2026-01-01T00:01:00.000Z");

    expect(transformed.series).toHaveLength(4);
    expect(transformed.series).toEqual(
      expect.arrayContaining([
        {
          name: "cpu (host=api-1)",
          labels: { host: "api-1" },
          values: [
            [t0, 0.5],
            [t1, 0.7],
          ],
        },
        {
          name: "cpu (host=api-2)",
          labels: { host: "api-2" },
          values: [[t0, 0.8]],
        },
        {
          name: "memory (host=api-1)",
          labels: { host: "api-1" },
          values: [
            [t0, 200],
            [t1, 220],
          ],
        },
        {
          name: "memory (host=api-2)",
          labels: { host: "api-2" },
          values: [[t0, 260]],
        },
      ]),
    );
  });

  it("uses row indices as timestamps when no timestamp column exists", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "service", type: "keyword" },
        { name: "errors", type: "long" },
      ],
      values: [
        ["checkout", 2],
        ["checkout", 3],
      ],
    };

    const transformed = toTimeSeriesData(data);

    expect(transformed.series).toEqual([
      {
        name: "errors (service=checkout)",
        labels: { service: "checkout" },
        values: [
          [0, 2],
          [1, 3],
        ],
      },
    ]);
  });

  it("extracts stat values from the latest timestamp row", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "@timestamp", type: "date" },
        { name: "cpu", type: "double" },
        { name: "memory", type: "long" },
      ],
      values: [
        ["2026-01-01T00:02:00.000Z", 0.9, 300],
        ["2026-01-01T00:01:00.000Z", 0.6, 240],
        ["2026-01-01T00:03:00.000Z", 1.1, 330],
      ],
    };

    expect(toStatData(data)).toEqual([
      { name: "cpu", value: 1.1 },
      { name: "memory", value: 330 },
    ]);
  });

  it("converts ES|QL rows to grouped categorical bar data", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "doc_count", type: "long" },
        { name: "dataset", type: "keyword" },
        { name: "type", type: "keyword" },
      ],
      values: [
        [100, "nginx", "logs"],
        [200, "nginx", "metrics"],
        [150, "system", "logs"],
        [250, "system", "metrics"],
      ],
    };

    expect(toBarChartData(data)).toEqual({
      categories: ["nginx", "system"],
      series: [
        { name: "logs", values: [100, 150] },
        { name: "metrics", values: [200, 250] },
      ],
    });
  });

  it("converts ES|QL rows to ungrouped categorical bar data", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "@timestamp", type: "date" },
        { name: "service", type: "keyword" },
        { name: "doc_count", type: "long" },
      ],
      values: [
        ["2026-01-01T00:00:00.000Z", "nginx", 100],
        ["2026-01-01T00:01:00.000Z", "system", 250],
      ],
    };

    expect(toBarChartData(data)).toEqual({
      categories: ["nginx", "system"],
      series: [{ name: "doc_count", values: [100, 250] }],
    });
  });

  it("extracts gauge data from latest timestamp row", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "@timestamp", type: "date" },
        { name: "cpu", type: "double" },
      ],
      values: [
        ["2026-01-01T00:02:00.000Z", 0.9],
        ["2026-01-01T00:01:00.000Z", 0.6],
        ["2026-01-01T00:03:00.000Z", 1.1],
      ],
    };

    expect(toGaugeData(data)).toEqual({
      name: "cpu",
      value: 1.1,
      values: [0.9, 0.6, 1.1],
    });
  });

  it("handles sparse rows in bar and gauge transforms", () => {
    const barData: EsqlResponse = {
      columns: [
        { name: "service", type: "keyword" },
        { name: "doc_count", type: "long" },
      ],
      values: [["nginx", 10], [], ["system", 20]],
    };
    const gaugeData: EsqlResponse = {
      columns: [{ name: "cpu", type: "double" }],
      values: [[0.9], [], [1.1]],
    };

    expect(toBarChartData(barData)).toEqual({
      categories: ["nginx", "(empty)", "system"],
      series: [{ name: "doc_count", values: [10, 0, 20] }],
    });
    expect(toGaugeData(gaugeData)).toEqual({
      name: "cpu",
      value: 1.1,
      values: [0.9, 0, 1.1],
    });
  });

  it("extracts stat values from the last row when no timestamp column exists", () => {
    const data: EsqlResponse = {
      columns: [{ name: "count", type: "long" }],
      values: [[1], [2], [5]],
    };

    expect(toStatData(data)).toEqual([{ name: "count", value: 5 }]);
  });

  it("returns empty outputs for empty rows", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "@timestamp", type: "date" },
        { name: "value", type: "long" },
      ],
      values: [],
    };

    expect(toTimeSeriesData(data)).toEqual({ series: [] });
    expect(toStatData(data)).toEqual([]);
    expect(toBarChartData(data)).toEqual({
      categories: [],
      series: [{ name: "value", values: [] }],
    });
    expect(toGaugeData(data)).toBeUndefined();
  });

  it("returns empty outputs when there are no numeric columns", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "@timestamp", type: "date" },
        { name: "service", type: "keyword" },
      ],
      values: [["2026-01-01T00:00:00.000Z", "checkout"]],
    };

    expect(toTimeSeriesData(data)).toEqual({ series: [] });
    expect(toStatData(data)).toEqual([]);
    expect(toBarChartData(data)).toEqual({ categories: [], series: [] });
    expect(toGaugeData(data)).toBeUndefined();
  });

  it("normalizes nullish metrics to null and falls back to row index for invalid timestamps", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "@timestamp", type: "date" },
        { name: "service", type: "keyword" },
        { name: "errors", type: "long" },
      ],
      values: [
        ["not-a-date", "checkout", null],
        [undefined, "checkout", undefined],
      ],
    };

    expect(toTimeSeriesData(data)).toEqual({
      series: [
        {
          name: "errors (service=checkout)",
          labels: { service: "checkout" },
          values: [
            [0, null],
            [1, null],
          ],
        },
      ],
    });
  });

  it("converts numeric date_nanos timestamps to milliseconds", () => {
    const t0Nanos = 1_735_689_600_000_000_000;
    const t1Nanos = 1_735_689_660_000_000_000;
    const data: EsqlResponse = {
      columns: [
        { name: "@timestamp", type: "date_nanos" },
        { name: "cpu", type: "double" },
      ],
      values: [
        [t0Nanos, 0.5],
        [t1Nanos, 0.7],
      ],
    };

    expect(toTimeSeriesData(data)).toEqual({
      series: [
        {
          name: "cpu",
          labels: undefined,
          values: [
            [1_735_689_600_000, 0.5],
            [1_735_689_660_000, 0.7],
          ],
        },
      ],
    });
    expect(toStatData(data)).toEqual([{ name: "cpu", value: 0.7 }]);
  });

  it("keeps distinct label groups when label values contain delimiters", () => {
    const timestamp = "2026-01-01T00:00:00.000Z";
    const data: EsqlResponse = {
      columns: [
        { name: "@timestamp", type: "date" },
        { name: "service", type: "keyword" },
        { name: "host", type: "keyword" },
        { name: "cpu", type: "double" },
      ],
      values: [
        [timestamp, "api-1|host=api-2", "api-3", 0.5],
        [timestamp, "api-1", "api-2|host=api-3", 0.7],
      ],
    };

    expect(toTimeSeriesData(data).series).toEqual(
      expect.arrayContaining([
        {
          name: "cpu (service=api-1|host=api-2, host=api-3)",
          labels: { service: "api-1|host=api-2", host: "api-3" },
          values: [[Date.parse(timestamp), 0.5]],
        },
        {
          name: "cpu (service=api-1, host=api-2|host=api-3)",
          labels: { service: "api-1", host: "api-2|host=api-3" },
          values: [[Date.parse(timestamp), 0.7]],
        },
      ]),
    );
  });

  it("keys series using deduplicated labels when dimension names repeat", () => {
    const timestamp = "2026-01-01T00:00:00.000Z";
    const data: EsqlResponse = {
      columns: [
        { name: "@timestamp", type: "date" },
        { name: "service", type: "keyword" },
        { name: "service", type: "keyword" },
        { name: "cpu", type: "double" },
      ],
      values: [
        [timestamp, "api-1", "api-2", 0.5],
        [timestamp, "api-9", "api-2", 0.7],
      ],
    };

    expect(toTimeSeriesData(data).series).toEqual([
      {
        name: "cpu (service=api-2)",
        labels: { service: "api-2" },
        values: [
          [Date.parse(timestamp), 0.5],
          [Date.parse(timestamp), 0.7],
        ],
      },
    ]);
  });

  it("handles __proto__ labels and control characters without key collisions", () => {
    const timestamp = "2026-01-01T00:00:00.000Z";
    const data: EsqlResponse = {
      columns: [
        { name: "@timestamp", type: "date" },
        { name: "__proto__", type: "keyword" },
        { name: "service", type: "keyword" },
        { name: "cpu", type: "double" },
      ],
      values: [
        [timestamp, "x", `a\0b\x1fc`, 0.5],
        [timestamp, "x\0", `b\x1fc`, 0.7],
      ],
    };

    const transformed = toTimeSeriesData(data).series;
    expect(transformed).toHaveLength(2);

    const firstSeries = transformed.find(
      (series) => series.name === `cpu (__proto__=x, service=a\0b\x1fc)`,
    );
    const secondSeries = transformed.find(
      (series) => series.name === `cpu (__proto__=x\0, service=b\x1fc)`,
    );

    expect(firstSeries?.labels?.["__proto__"]).toBe("x");
    expect(firstSeries?.labels?.service).toBe(`a\0b\x1fc`);
    expect(firstSeries?.values).toEqual([[Date.parse(timestamp), 0.5]]);

    expect(secondSeries?.labels?.["__proto__"]).toBe("x\0");
    expect(secondSeries?.labels?.service).toBe(`b\x1fc`);
    expect(secondSeries?.values).toEqual([[Date.parse(timestamp), 0.7]]);
  });
});
