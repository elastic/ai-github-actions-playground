import { describe, expect, it } from "vitest";

import { toStatData, toTimeSeriesData } from "../../src/services/perses/dataTransformers";
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

  it("extracts stat values from the last row when no timestamp column exists", () => {
    const data: EsqlResponse = {
      columns: [{ name: "count", type: "long" }],
      values: [[1], [2], [5]],
    };

    expect(toStatData(data)).toEqual([{ name: "count", value: 5 }]);
  });
});
