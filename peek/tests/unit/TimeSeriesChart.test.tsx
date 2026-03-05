import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import TimeSeriesChart from "../../src/components/visualizations/TimeSeriesChart";
import type { EsqlResponse } from "../../src/types";

const { mockSetOption, mockInit } = vi.hoisted(() => {
  const mockSetOption = vi.fn();
  const mockInit = vi.fn(() => ({
    setOption: mockSetOption,
    resize: vi.fn(),
    dispose: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getDataURL: vi.fn(() => "data:image/png;base64,mock"),
  }));
  return { mockSetOption, mockInit };
});

vi.mock("../../src/components/visualizations/useEChartTheme", () => ({
  useEChartTheme: () => ({
    color: ["#0077CC", "#00BFA5", "#FF6F00"],
    tooltip: {},
    legend: {},
    xAxis: { axisLabel: {} },
    yAxis: { axisLabel: {} },
  }),
}));

vi.mock("@perses-dev/components", () => ({
  EChart: function MockEChart(props: Record<string, unknown>) {
    const inst = mockInit(null, props.theme);
    inst.setOption(props.option, true);
    const ref = props._instance as React.MutableRefObject<unknown> | undefined;
    if (ref) ref.current = inst;
    const onInit = props.onChartInitialized as ((i: unknown) => void) | undefined;
    if (onInit) onInit(inst);
    return null;
  },
}));

/** Returns the option object from the most recent EChart setOption() call. */
function getLastSetOptionCall(): Record<string, unknown> {
  const calls = mockSetOption.mock.calls;
  return calls[calls.length - 1]?.[0] as Record<string, unknown>;
}

describe("TimeSeriesChart", () => {
  beforeEach(() => {
    mockInit.mockClear();
    mockSetOption.mockClear();
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

  it("splits data by group column and names series with metric and labels", () => {
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
    expect(series.map((s) => s.name)).toEqual([
      "doc_count (data_stream.type=logs)",
      "doc_count (data_stream.type=metrics)",
      "doc_count (data_stream.type=traces)",
    ]);

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

  it("sets custom axisLabel formatter when timeZone is provided and data has a date column", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "doc_count", type: "long" },
        { name: "time_bucket", type: "date" },
      ],
      values: [
        [100, "2024-06-01T12:00:00Z"],
        [200, "2024-06-02T12:00:00Z"],
      ],
    };
    render(<TimeSeriesChart data={data} timeZone="UTC" />);
    const option = getLastSetOptionCall();
    const xAxis = option.xAxis as { axisLabel?: { formatter?: unknown } };
    expect(typeof xAxis.axisLabel?.formatter).toBe("function");
  });

  it("sets a formatter on xAxis when data has a date column even without timeZone", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "doc_count", type: "long" },
        { name: "time_bucket", type: "date" },
      ],
      values: [
        [100, "2024-06-01T12:00:00Z"],
        [200, "2024-06-02T12:00:00Z"],
      ],
    };
    render(<TimeSeriesChart data={data} />);
    const option = getLastSetOptionCall();
    const xAxis = option.xAxis as { axisLabel?: { formatter?: unknown } };
    expect(typeof xAxis.axisLabel?.formatter).toBe("function");
  });

  it("formats axis labels consistently regardless of local timezone when timeZone is UTC", () => {
    const data: EsqlResponse = {
      columns: [
        { name: "doc_count", type: "long" },
        { name: "time_bucket", type: "date" },
      ],
      values: [[42, "2024-01-15T06:30:00Z"]],
    };
    render(<TimeSeriesChart data={data} timeZone="UTC" />);
    const option = getLastSetOptionCall();
    const xAxis = option.xAxis as { axisLabel?: { formatter?: (v: number) => string } };
    const formatter = xAxis.axisLabel?.formatter;
    expect(formatter).toBeDefined();
    const formatted = formatter?.(new Date("2024-01-15T06:30:00Z").getTime());
    // UTC should show Jan 15, 06:30
    expect(formatted).toContain("Jan");
    expect(formatted).toContain("15");
    expect(formatted).toContain("06:30");
  });
});
