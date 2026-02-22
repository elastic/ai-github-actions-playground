import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import * as echarts from "echarts/core";
import HistogramChart from "../../src/components/visualizations/HistogramChart";
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

describe("HistogramChart", () => {
  beforeEach(() => {
    (echarts.init as ReturnType<typeof vi.fn>).mockClear();
  });

  it("shows error title when there are no numeric columns", () => {
    const data: EsqlResponse = {
      columns: [{ name: "label", type: "keyword" }],
      values: [["a"]],
    };
    render(<HistogramChart data={data} />);
    const option = getLastSetOptionCall();
    expect(option.title).toEqual(
      expect.objectContaining({ text: "No numeric data to display" }),
    );
  });

  it("shows error title when all numeric values are null", () => {
    const data: EsqlResponse = {
      columns: [{ name: "value", type: "double" }],
      values: [[null], [null]],
    };
    render(<HistogramChart data={data} />);
    const option = getLastSetOptionCall();
    expect(option.title).toEqual(
      expect.objectContaining({ text: "No numeric data to display" }),
    );
  });

  it("distributes values into the correct number of bins", () => {
    const data: EsqlResponse = {
      columns: [{ name: "latency", type: "double" }],
      values: [[0], [25], [50], [75], [100]],
    };
    render(<HistogramChart data={data} options={{ bins: 4 }} />);
    const option = getLastSetOptionCall();
    const series = option.series as { data: number[] }[];
    const counts = series[0].data;
    expect(counts).toHaveLength(4);
    // Sum of all bins should equal number of values
    expect(counts.reduce((a, b) => a + b, 0)).toBe(5);
  });

  it("handles all identical values without crashing", () => {
    const data: EsqlResponse = {
      columns: [{ name: "value", type: "double" }],
      values: [[42], [42], [42]],
    };
    render(<HistogramChart data={data} options={{ bins: 5 }} />);
    const option = getLastSetOptionCall();
    const series = option.series as { data: number[] }[];
    // All values should land in one bin, total count = 3
    expect(series[0].data.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("filters out null values before binning", () => {
    const data: EsqlResponse = {
      columns: [{ name: "value", type: "double" }],
      values: [[10], [null], [20], [null], [30]],
    };
    render(<HistogramChart data={data} options={{ bins: 3 }} />);
    const option = getLastSetOptionCall();
    const series = option.series as { data: number[] }[];
    // Only 3 non-null values
    expect(series[0].data.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("defaults to 10 bins when options not provided", () => {
    const data: EsqlResponse = {
      columns: [{ name: "value", type: "double" }],
      values: Array.from({ length: 100 }, (_, i) => [i]),
    };
    render(<HistogramChart data={data} />);
    const option = getLastSetOptionCall();
    const xAxis = option.xAxis as { data: string[] };
    expect(xAxis.data).toHaveLength(10);
  });

  it("rotates labels when bins exceed 10", () => {
    const data: EsqlResponse = {
      columns: [{ name: "value", type: "double" }],
      values: Array.from({ length: 100 }, (_, i) => [i]),
    };
    render(<HistogramChart data={data} options={{ bins: 15 }} />);
    const option = getLastSetOptionCall();
    const xAxis = option.xAxis as { axisLabel: { rotate: number } };
    expect(xAxis.axisLabel.rotate).toBe(45);
  });
});
