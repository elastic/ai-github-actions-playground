import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import * as echarts from "echarts/core";

import BarChart from "../../src/components/visualizations/BarChart";
import type { EsqlResponse } from "../../src/types";

vi.mock("../../src/components/visualizations/useEChartTheme", () => ({
  useEChartTheme: () => ({
    color: ["#0077CC", "#00BFA5", "#FF6F00"],
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

describe("BarChart", () => {
  beforeEach(() => {
    (echarts.init as ReturnType<typeof vi.fn>).mockClear();
  });

  it("uses column name as series name with single string column", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "doc_count", type: "long" },
        { name: "dataset", type: "keyword" },
      ],
      values: [
        [100, "nginx"],
        [200, "system"],
      ],
    };
    render(<BarChart data={data} />);
    const option = getLastSetOptionCall();
    const series = option.series as { name: string }[];
    expect(series).toHaveLength(1);
    expect(series[0]!.name).toBe("doc_count");
  });

  it("groups by second string column when two string columns exist", () => {
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
    render(<BarChart data={data} />);
    const option = getLastSetOptionCall();
    const series = option.series as { name: string; data: number[] }[];

    expect(series).toHaveLength(2);
    expect(series.map((s) => s.name)).toEqual(["logs", "metrics"]);

    // logs series: nginx=100, system=150
    expect(series[0]!.data).toEqual([100, 150]);
    // metrics series: nginx=200, system=250
    expect(series[1]!.data).toEqual([200, 250]);

    // Categories should be deduplicated
    const xAxis = option.xAxis as { data: string[] };
    expect(xAxis.data).toEqual(["nginx", "system"]);
  });

  it("sums duplicate rows for the same category and group", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "doc_count", type: "long" },
        { name: "dataset", type: "keyword" },
        { name: "type", type: "keyword" },
      ],
      values: [
        [100, "nginx", "logs"],
        [25, "nginx", "logs"],
        [200, "nginx", "metrics"],
        [150, "system", "logs"],
        [50, "system", "metrics"],
      ],
    };

    render(<BarChart data={data} />);
    const option = getLastSetOptionCall();
    const series = option.series as { name: string; data: number[] }[];

    expect(series.map((s) => s.name)).toEqual(["logs", "metrics"]);
    expect(series[0]!.data).toEqual([125, 150]);
    expect(series[1]!.data).toEqual([200, 50]);
  });

  it("shows error title when no numeric columns", () => {
    const data: EsqlResponse = {
      columns: [{ name: "label", type: "keyword" }],
      values: [["A"]],
    };
    render(<BarChart data={data} />);
    const option = getLastSetOptionCall();
    expect(option.title).toEqual(expect.objectContaining({ text: "No numeric data to display" }));
  });
});
