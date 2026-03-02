import { describe, it, expect } from "vitest";

import {
  buildServiceGraphOption,
  type EdgeExtras,
} from "../../src/components/visualizations/serviceGraphOptions";
import type { ServiceMapData } from "../../src/components/traces/traceUtils";

function makeMapData(overrides?: Partial<ServiceMapData>): ServiceMapData {
  return {
    nodes: [
      { serviceName: "frontend", spanCount: 100, errorCount: 0 },
      { serviceName: "backend", spanCount: 50, errorCount: 5 },
    ],
    edges: [
      {
        source: "frontend",
        target: "backend",
        callCount: 20,
        errorCount: 1,
        totalDurationUs: 400_000,
      },
    ],
    ...overrides,
  };
}

describe("buildServiceGraphOption", () => {
  it("returns a valid ECharts option with tooltip and series", () => {
    const option = buildServiceGraphOption({ mapData: makeMapData() });
    expect(option).toHaveProperty("tooltip");
    expect(option).toHaveProperty("series");
    expect(option.series).toHaveLength(1);
    expect(option.series[0].type).toBe("graph");
  });

  it("maps nodes with correct id and symbolSize", () => {
    const mapData = makeMapData();
    const option = buildServiceGraphOption({ mapData });
    const nodes = option.series[0].data;
    expect(nodes).toHaveLength(2);
    expect(nodes[0].id).toBe("frontend");
    expect(nodes[1].id).toBe("backend");
    expect(nodes[0].symbolSize).toBeGreaterThan(nodes[1].symbolSize);
  });

  it("maps edges with avgLatencyMs computed", () => {
    const option = buildServiceGraphOption({ mapData: makeMapData() });
    const links = option.series[0].links;
    expect(links).toHaveLength(1);
    expect(links[0].source).toBe("frontend");
    expect(links[0].target).toBe("backend");
    expect(links[0].avgLatencyMs).toBe(20); // 400_000 / 20 / 1000
  });

  it("uses default error color when none specified", () => {
    const data = makeMapData({
      nodes: [{ serviceName: "svc", spanCount: 10, errorCount: 3 }],
      edges: [],
    });
    const option = buildServiceGraphOption({ mapData: data });
    const node = option.series[0].data[0];
    expect(node.itemStyle.borderColor).toBe("#DE350B");
  });

  it("uses custom error color when provided", () => {
    const data = makeMapData({
      nodes: [{ serviceName: "svc", spanCount: 10, errorCount: 3 }],
      edges: [],
    });
    const option = buildServiceGraphOption({ mapData: data, errorColor: "#FF0000" });
    const node = option.series[0].data[0];
    expect(node.itemStyle.borderColor).toBe("#FF0000");
  });

  it("applies edgeExtras overrides", () => {
    const option = buildServiceGraphOption({
      mapData: makeMapData(),
      edgeExtras: (): EdgeExtras => ({
        tooltipSuffix: " [regressed]",
        color: "#00FF00",
        opacity: 0.9,
        data: { edgeStatus: "regressed" },
      }),
    });
    const link = option.series[0].links[0];
    expect(link._tooltipSuffix).toBe(" [regressed]");
    expect(link.lineStyle.color).toBe("#00FF00");
    expect(link.lineStyle.opacity).toBe(0.9);
    expect(link.edgeStatus).toBe("regressed");
  });

  it("defaults edge opacity to 0.75 without edgeExtras", () => {
    const option = buildServiceGraphOption({ mapData: makeMapData() });
    expect(option.series[0].links[0].lineStyle.opacity).toBe(0.75);
  });
});
