import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import * as echarts from "echarts/core";

import TimeSeriesChart from "../../src/components/visualizations/TimeSeriesChart";
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

describe("TimeSeriesChart", () => {
  beforeEach(() => {
    (echarts.init as ReturnType<typeof vi.fn>).mockClear();
  });

  it("uses column name as series name when no group column exists", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "doc_count", type: "long" },
        { name: "time_bucket", type: "date" },
      ],
      values: [
        [100, "2024-01-01T00:00:00Z"],
        [200, "2024-01-02T00:00:00Z"],
      ],
    };
    render(<TimeSeriesChart data={data} />);
    const option = getLastSetOptionCall();
    const series = option.series as { name: string }[];
    expect(series).toHaveLength(1);
    expect(series[0]!.name).toBe("doc_count");
  });

  it("splits data by group column and names series after group values", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "doc_count", type: "long" },
        { name: "time_bucket", type: "date" },
        { name: "data_stream.type", type: "keyword" },
      ],
      values: [
        [100, "2024-01-01T00:00:00Z", "logs"],
        [200, "2024-01-01T00:00:00Z", "metrics"],
        [50, "2024-01-01T00:00:00Z", "traces"],
        [150, "2024-01-02T00:00:00Z", "logs"],
        [250, "2024-01-02T00:00:00Z", "metrics"],
        [80, "2024-01-02T00:00:00Z", "traces"],
      ],
    };
    render(<TimeSeriesChart data={data} />);
    const option = getLastSetOptionCall();
    const series = option.series as { name: string; data: unknown[][] }[];

    expect(series).toHaveLength(3);
    expect(series.map((s) => s.name)).toEqual(["logs", "metrics", "traces"]);

    // Each series should have exactly 2 data points
    expect(series[0]!.data).toHaveLength(2);
    expect(series[1]!.data).toHaveLength(2);
    expect(series[2]!.data).toHaveLength(2);

    // Verify data values: logs series should have [100, 150]
    expect(series[0]!.data.map((d) => d[1])).toEqual([100, 150]);
    // metrics series: [200, 250]
    expect(series[1]!.data.map((d) => d[1])).toEqual([200, 250]);
    // traces series: [50, 80]
    expect(series[2]!.data.map((d) => d[1])).toEqual([50, 80]);
  });

  it("shows legend when multiple grouped series exist", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "doc_count", type: "long" },
        { name: "time_bucket", type: "date" },
        { name: "type", type: "keyword" },
      ],
      values: [
        [100, "2024-01-01T00:00:00Z", "logs"],
        [200, "2024-01-01T00:00:00Z", "metrics"],
      ],
    };
    render(<TimeSeriesChart data={data} />);
    const option = getLastSetOptionCall();
    expect((option.legend as { show: boolean }).show).toBe(true);
  });

  it("shows error title when no numeric columns", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "ts", type: "date" },
        { name: "label", type: "keyword" },
      ],
      values: [["2024-01-01", "A"]],
    };
    render(<TimeSeriesChart data={data} />);
    const option = getLastSetOptionCall();
    expect(option.title).toEqual(expect.objectContaining({ text: "No numeric data to display" }));
  });
});
