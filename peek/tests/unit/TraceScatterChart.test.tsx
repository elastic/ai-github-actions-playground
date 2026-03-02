import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useEffect } from "react";

import TraceScatterChart from "../../src/components/visualizations/TraceScatterChart";

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
    color: ["#0077CC", "#00BFA5"],
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
    useEffect(() => {
      if (!ref) return;
      ref.current = inst;
      return () => {
        ref.current = undefined;
      };
    }, [ref, inst]);
    return null;
  },
}));

function getLastSetOptionCall(): Record<string, unknown> {
  const calls = mockSetOption.mock.calls;
  return calls[calls.length - 1]?.[0] as Record<string, unknown>;
}

interface DataPoint {
  timestamp: string;
  durationUs: number;
  serviceName: string;
  traceId: string;
}

function makePoint(overrides: Partial<DataPoint> = {}): DataPoint {
  return {
    timestamp: "2026-01-01T00:00:00.000Z",
    durationUs: 50_000,
    serviceName: "api-gateway",
    traceId: "trace-1",
    ...overrides,
  };
}

describe("TraceScatterChart", () => {
  beforeEach(() => {
    mockInit.mockClear();
    mockSetOption.mockClear();
  });

  it("shows empty title when no data is provided", () => {
    render(<TraceScatterChart data={[]} />);
    const option = getLastSetOptionCall();
    expect(option.title).toEqual(expect.objectContaining({ text: "No data to display" }));
  });

  it("renders scatter points for a single service", () => {
    const data = [
      makePoint({ traceId: "t1", durationUs: 10_000 }),
      makePoint({ traceId: "t2", durationUs: 20_000 }),
    ];
    render(<TraceScatterChart data={data} />);
    const option = getLastSetOptionCall();
    const series = option.series as Array<{
      name: string;
      data: Array<{ value: [number, number] }>;
    }>;
    expect(series).toHaveLength(1);
    expect(series[0]!.name).toBe("api-gateway");
    expect(series[0]!.data).toHaveLength(2);
    // Duration should be in ms (durationUs / 1000)
    expect(series[0]!.data[0]!.value[1]).toBe(10); // 10_000 / 1000
    expect(series[0]!.data[1]!.value[1]).toBe(20); // 20_000 / 1000
  });

  it("groups data by service name into separate series", () => {
    const data = [
      makePoint({ serviceName: "auth", traceId: "t1" }),
      makePoint({ serviceName: "api", traceId: "t2" }),
      makePoint({ serviceName: "auth", traceId: "t3" }),
    ];
    render(<TraceScatterChart data={data} />);
    const option = getLastSetOptionCall();
    const series = option.series as Array<{ name: string; data: unknown[] }>;
    expect(series).toHaveLength(2);

    const authSeries = series.find((s) => s.name === "auth");
    const apiSeries = series.find((s) => s.name === "api");
    expect(authSeries?.data).toHaveLength(2);
    expect(apiSeries?.data).toHaveLength(1);
  });

  it("filters out zero-duration points to prevent log(0)", () => {
    const data = [
      makePoint({ traceId: "t1", durationUs: 50_000 }),
      makePoint({ traceId: "t2", durationUs: 0 }),
      makePoint({ traceId: "t3", durationUs: 30_000 }),
    ];
    render(<TraceScatterChart data={data} />);
    const option = getLastSetOptionCall();
    const series = option.series as Array<{ data: unknown[] }>;
    // Only 2 points should remain (durationUs=0 filtered out)
    expect(series[0]!.data).toHaveLength(2);
  });

  it("shows empty title when all points are filtered out", () => {
    const data = [
      makePoint({ traceId: "t1", durationUs: 0 }),
      makePoint({ traceId: "t2", durationUs: -10 }),
    ];
    render(<TraceScatterChart data={data} />);
    const option = getLastSetOptionCall();
    expect(option.title).toEqual(expect.objectContaining({ text: "No data to display" }));
  });

  it("uses log scale for y-axis", () => {
    render(<TraceScatterChart data={[makePoint()]} />);
    const option = getLastSetOptionCall();
    const yAxis = option.yAxis as { type: string; name: string };
    expect(yAxis.type).toBe("log");
    expect(yAxis.name).toBe("Duration (ms)");
  });

  it("uses time scale for x-axis", () => {
    render(<TraceScatterChart data={[makePoint()]} />);
    const option = getLastSetOptionCall();
    const xAxis = option.xAxis as { type: string };
    expect(xAxis.type).toBe("time");
  });

  it("hides legend when only one service", () => {
    render(<TraceScatterChart data={[makePoint()]} />);
    const option = getLastSetOptionCall();
    const legend = option.legend as { show: boolean };
    expect(legend.show).toBe(false);
  });

  it("shows legend when multiple services", () => {
    const data = [makePoint({ serviceName: "svc-a" }), makePoint({ serviceName: "svc-b" })];
    render(<TraceScatterChart data={data} />);
    const option = getLastSetOptionCall();
    const legend = option.legend as { show: boolean };
    expect(legend.show).toBe(true);
  });

  it("invokes onPointClick with traceId when a point is clicked", () => {
    const onPointClick = vi.fn();
    render(
      <TraceScatterChart
        data={[makePoint({ traceId: "clicked-trace" })]}
        onPointClick={onPointClick}
      />,
    );

    const mockInstance = mockInit.mock.results[0]?.value;
    const onFn = mockInstance?.on as ReturnType<typeof vi.fn>;
    const clickCall = onFn.mock.calls.find((c: unknown[]) => c[0] === "click");
    expect(clickCall).toBeDefined();
    const handler = clickCall![1] as (params: { data: unknown }) => void;
    handler({ data: { traceId: "clicked-trace" } });
    expect(onPointClick).toHaveBeenCalledWith("clicked-trace");
  });

  it("does not register click handler when onPointClick is not provided", () => {
    render(<TraceScatterChart data={[makePoint()]} />);
    const mockInstance = mockInit.mock.results[0]?.value;
    const onFn = mockInstance?.on as ReturnType<typeof vi.fn>;
    const clickCall = onFn.mock.calls.find((c: unknown[]) => c[0] === "click");
    expect(clickCall).toBeUndefined();
  });
});
