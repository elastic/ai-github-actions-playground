import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import * as echarts from "echarts/core";
import HeatmapChart from "../../src/components/visualizations/HeatmapChart";
import type { EsqlResponse } from "../../src/types";

vi.mock("../../src/components/visualizations/useEChartTheme", () => ({
  useEChartTheme: () => ({
    color: ["#0077CC", "#00BFA5"],
    tooltip: {},
    legend: {},
    xAxis: { axisLabel: {} },
    yAxis: { axisLabel: {} },
  }),
}));

/** Returns the option object from the most recent echarts.init().setOption() call. */
function getLastSetOptionCall(): Record<string, unknown> {
  const mockInit = echarts.init as ReturnType<typeof vi.fn>;
  const results = mockInit.mock.results;
  const mockInstance = results[results.length - 1]?.value;
  const setOption = mockInstance?.setOption as ReturnType<typeof vi.fn>;
  const calls = setOption.mock.calls;
  return calls[calls.length - 1]?.[0] as Record<string, unknown>;
}

describe("HeatmapChart", () => {
  beforeEach(() => {
    (echarts.init as ReturnType<typeof vi.fn>).mockClear();
  });

  it("shows error title when there are no numeric columns", () => {
    const data: EsqlResponse = {
      columns: [{ name: "label", type: "keyword" }],
      values: [["a"], ["b"]],
    };
    render(<HeatmapChart data={data} />);
    const option = getLastSetOptionCall();
    expect(option.title).toEqual(
      expect.objectContaining({ text: "No numeric data to display" }),
    );
  });

  it("shows error title when all numeric values are null", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "x", type: "keyword" },
        { name: "y", type: "keyword" },
        { name: "value", type: "double" },
      ],
      values: [
        ["a", "b", null],
        ["c", "d", null],
      ],
    };
    render(<HeatmapChart data={data} />);
    const option = getLastSetOptionCall();
    expect(option.title).toEqual(
      expect.objectContaining({ text: "No numeric data to display" }),
    );
  });

  it("computes correct visualMap min/max filtering out nulls", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "x", type: "keyword" },
        { name: "y", type: "keyword" },
        { name: "value", type: "double" },
      ],
      values: [
        ["a", "p", 10],
        ["b", "q", null],
        ["c", "r", 30],
      ],
    };
    render(<HeatmapChart data={data} />);
    const option = getLastSetOptionCall();
    const visualMap = option.visualMap as { min: number; max: number };
    expect(visualMap.min).toBe(10);
    expect(visualMap.max).toBe(30);
  });

  it("generates heatmap series data with correct axis indices", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "method", type: "keyword" },
        { name: "status", type: "keyword" },
        { name: "count", type: "long" },
      ],
      values: [
        ["GET", "200", 50],
        ["POST", "200", 30],
        ["GET", "404", 10],
      ],
    };
    render(<HeatmapChart data={data} />);
    const option = getLastSetOptionCall();
    const xAxis = option.xAxis as { data: string[] };
    const yAxis = option.yAxis as { data: string[] };

    expect(xAxis.data).toEqual(["GET", "POST"]);
    expect(yAxis.data).toEqual(["200", "404"]);

    const series = option.series as { data: number[][] }[];
    // [xIdx, yIdx, value]: GET/200=50, POST/200=30, GET/404=10
    expect(series[0].data).toEqual([
      [0, 0, 50],
      [1, 0, 30],
      [0, 1, 10],
    ]);
  });

  it("falls back to row indices when no string columns exist", () => {
    const data: EsqlResponse = {
      columns: [{ name: "value", type: "double" }],
      values: [[5], [15]],
    };
    render(<HeatmapChart data={data} />);
    const option = getLastSetOptionCall();
    const xAxis = option.xAxis as { data: string[] };
    expect(xAxis.data).toEqual(["0", "1"]);
  });
});
