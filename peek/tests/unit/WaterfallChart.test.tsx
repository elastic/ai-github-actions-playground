import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import * as echarts from "echarts/core";
import WaterfallChart from "../../src/components/visualizations/WaterfallChart";
import type { Span } from "../../src/components/traces/traceUtils";

vi.mock("../../src/components/visualizations/useEChartTheme", () => ({
  useEChartTheme: () => ({
    color: ["#0077CC", "#00BFA5"],
    tooltip: {},
    legend: {},
    xAxis: { axisLabel: {}, splitLine: {} },
    yAxis: { axisLabel: {} },
  }),
}));

function getLastSetOptionCall(): Record<string, unknown> {
  const mockInit = echarts.init as ReturnType<typeof vi.fn>;
  const results = mockInit.mock.results;
  const mockInstance = results[results.length - 1]?.value;
  const setOption = mockInstance?.setOption as ReturnType<typeof vi.fn>;
  const calls = setOption.mock.calls;
  return calls[calls.length - 1]?.[0] as Record<string, unknown>;
}

const BASE_TIME_US = new Date("2026-01-01T00:00:00.000Z").getTime() * 1000;

function makeSpan(overrides: Partial<Span> = {}): Span {
  return {
    traceId: "trace-1",
    spanId: "span-1",
    parentSpanId: null,
    serviceName: "api-gateway",
    name: "GET /users",
    kind: "SERVER",
    durationUs: 50_000,
    status: "OK",
    timestamp: "2026-01-01T00:00:00.000Z",
    startTimeUs: BASE_TIME_US,
    attributes: {},
    ...overrides,
  };
}

describe("WaterfallChart", () => {
  beforeEach(() => {
    (echarts.init as ReturnType<typeof vi.fn>).mockClear();
  });

  it("shows empty title when no spans are provided", () => {
    render(<WaterfallChart spans={[]} />);
    const option = getLastSetOptionCall();
    expect(option.title).toEqual(expect.objectContaining({ text: "No spans to display" }));
  });

  it("renders a single span as a stacked bar chart", () => {
    render(<WaterfallChart spans={[makeSpan()]} />);
    const option = getLastSetOptionCall();
    const series = option.series as Array<{ name: string; type: string; data: unknown[] }>;
    expect(series).toHaveLength(2); // Offset + Duration
    expect(series[0]!.name).toBe("Offset");
    expect(series[1]!.name).toBe("Duration");
    expect(series[1]!.data).toHaveLength(1);
  });

  it("builds a parent-child waterfall with correct offsets", () => {
    const spans = [
      makeSpan({
        spanId: "root",
        parentSpanId: null,
        startTimeUs: BASE_TIME_US,
        durationUs: 100_000,
      }),
      makeSpan({
        spanId: "child",
        parentSpanId: "root",
        startTimeUs: BASE_TIME_US + 10_000,
        durationUs: 50_000,
        serviceName: "auth-service",
      }),
    ];
    render(<WaterfallChart spans={spans} />);
    const option = getLastSetOptionCall();

    // y-axis categories should have root and child
    const yAxis = option.yAxis as { data: string[] };
    expect(yAxis.data).toHaveLength(2);
    expect(yAxis.data[0]).toContain("api-gateway");
    expect(yAxis.data[1]).toContain("auth-service");

    // Offset series: root=0, child=10ms
    const offsetSeries = (option.series as Array<{ data: number[] }>)[0]!;
    expect(offsetSeries.data[0]).toBe(0); // root starts at 0
    expect(offsetSeries.data[1]).toBeCloseTo(10); // child offset 10ms
  });

  it("marks error spans with a red border", () => {
    const spans = [
      makeSpan({ spanId: "ok-span", status: "OK" }),
      makeSpan({
        spanId: "err-span",
        parentSpanId: "ok-span",
        status: "Error",
        startTimeUs: BASE_TIME_US + 1000,
      }),
    ];
    render(<WaterfallChart spans={spans} />);
    const option = getLastSetOptionCall();
    const durationSeries = (
      option.series as Array<{ data: Array<{ itemStyle: { borderColor: string } }> }>
    )[1]!;
    // First span (OK) should have transparent border
    expect(durationSeries.data[0]!.itemStyle.borderColor).toBe("transparent");
    // Second span (Error) should have red border
    expect(durationSeries.data[1]!.itemStyle.borderColor).toBe("#BD271E");
  });

  it("highlights selected span with gold border", () => {
    const spans = [
      makeSpan({ spanId: "span-a" }),
      makeSpan({
        spanId: "span-b",
        parentSpanId: "span-a",
        startTimeUs: BASE_TIME_US + 1000,
      }),
    ];
    render(<WaterfallChart spans={spans} selectedSpanId="span-b" />);
    const option = getLastSetOptionCall();
    const durationSeries = (
      option.series as Array<{ data: Array<{ itemStyle: { borderColor: string } }> }>
    )[1]!;
    expect(durationSeries.data[0]!.itemStyle.borderColor).not.toBe("#FFD700");
    expect(durationSeries.data[1]!.itemStyle.borderColor).toBe("#FFD700");
  });

  it("tooltip formatter returns fallback for out-of-bounds index", () => {
    render(<WaterfallChart spans={[makeSpan()]} />);
    const option = getLastSetOptionCall();
    const tooltip = option.tooltip as {
      formatter: (params: Array<{ dataIndex: number }>) => string;
    };
    // Simulate out-of-bounds
    const result = tooltip.formatter([{ dataIndex: 999 }]);
    expect(result).toBe("Unknown span");
  });

  it("tooltip formatter returns fallback for empty params", () => {
    render(<WaterfallChart spans={[makeSpan()]} />);
    const option = getLastSetOptionCall();
    const tooltip = option.tooltip as {
      formatter: (params: Array<{ dataIndex: number }>) => string;
    };
    const result = tooltip.formatter([]);
    expect(result).toBe("Unknown span");
  });

  it("invokes onSpanClick with the correct spanId", () => {
    const onSpanClick = vi.fn();
    render(<WaterfallChart spans={[makeSpan({ spanId: "clicked" })]} onSpanClick={onSpanClick} />);

    // Get the click handler registered on EChartWrapper
    const mockInit = echarts.init as ReturnType<typeof vi.fn>;
    const mockInstance = mockInit.mock.results[0]?.value;
    const onFn = mockInstance?.on as ReturnType<typeof vi.fn>;
    // Find the "click" handler
    const clickCall = onFn.mock.calls.find((c: unknown[]) => c[0] === "click");
    if (clickCall) {
      const handler = clickCall[1] as (params: { dataIndex: number }) => void;
      handler({ dataIndex: 0 });
      expect(onSpanClick).toHaveBeenCalledWith("clicked");
    }
  });

  it("enables dataZoom for large trace trees", () => {
    const spans = Array.from({ length: 30 }, (_, i) =>
      makeSpan({
        spanId: `span-${i}`,
        parentSpanId: i === 0 ? null : "span-0",
        startTimeUs: BASE_TIME_US + i * 1000,
      }),
    );
    render(<WaterfallChart spans={spans} />);
    const option = getLastSetOptionCall();
    const dataZoom = option.dataZoom as Array<{ type: string }>;
    expect(dataZoom).toHaveLength(2);
    expect(dataZoom[0]!.type).toBe("inside");
    expect(dataZoom[1]!.type).toBe("slider");
  });
});
