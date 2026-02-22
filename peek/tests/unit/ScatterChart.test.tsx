import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import * as echarts from "echarts/core";
import ScatterChart from "../../src/components/visualizations/ScatterChart";
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

describe("ScatterChart", () => {
  beforeEach(() => {
    (echarts.init as ReturnType<typeof vi.fn>).mockClear();
  });

  it("shows error title when fewer than 2 numeric columns", () => {
    const data: EsqlResponse = {
      columns: [{ name: "x", type: "double" }],
      values: [[1], [2]],
    };
    render(<ScatterChart data={data} />);
    const option = getLastSetOptionCall();
    expect(option.title).toEqual(
      expect.objectContaining({ text: "Scatter requires at least 2 numeric columns" }),
    );
  });

  it("skips rows with null x or y values instead of plotting at origin", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "x", type: "double" },
        { name: "y", type: "double" },
      ],
      values: [
        [1, 10],
        [null, 20],
        [3, null],
        [4, 40],
      ],
    };
    render(<ScatterChart data={data} />);
    const option = getLastSetOptionCall();
    const series = option.series as { data: [number, number][] }[];
    // Only rows [1,10] and [4,40] should be included
    expect(series[0].data).toEqual([
      [1, 10],
      [4, 40],
    ]);
  });

  it("groups data by string column when present", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "group", type: "keyword" },
        { name: "x", type: "double" },
        { name: "y", type: "double" },
      ],
      values: [
        ["A", 1, 10],
        ["B", 2, 20],
        ["A", 3, 30],
      ],
    };
    render(<ScatterChart data={data} />);
    const option = getLastSetOptionCall();
    const series = option.series as { name: string; data: [number, number][] }[];
    expect(series).toHaveLength(2);

    const groupA = series.find((s) => s.name === "A");
    const groupB = series.find((s) => s.name === "B");
    expect(groupA?.data).toEqual([
      [1, 10],
      [3, 30],
    ]);
    expect(groupB?.data).toEqual([[2, 20]]);
  });

  it("uses column names for axis labels", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "latency_ms", type: "double" },
        { name: "throughput", type: "double" },
      ],
      values: [[100, 500]],
    };
    render(<ScatterChart data={data} />);
    const option = getLastSetOptionCall();
    expect((option.xAxis as { name: string }).name).toBe("latency_ms");
    expect((option.yAxis as { name: string }).name).toBe("throughput");
  });

  it("hides legend when only one series", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "x", type: "double" },
        { name: "y", type: "double" },
      ],
      values: [[1, 2]],
    };
    render(<ScatterChart data={data} />);
    const option = getLastSetOptionCall();
    expect((option.legend as { show: boolean }).show).toBe(false);
  });
});
