import { useCallback, useEffect, useMemo, useRef } from "react";

import type { Span } from "../traces/traceUtils";
import { buildServiceMapData } from "../traces/traceUtils";
import EmptyState from "../EmptyState";
import { EChart } from "../perses/PersesEChartWrapper";
import { useEChartTheme } from "../visualizations/useEChartTheme";
import type { EChartInstance } from "../visualizations/chartExport";

interface ServiceMiniDependencyGraphProps {
  serviceName: string;
  spans: Span[];
  onPeerServiceClick?: (serviceName: string) => void;
}

interface NeighborEdge {
  direction: "inbound" | "outbound";
  peerService: string;
  calls: number;
  errorRate: number;
}

function distributeY(index: number, total: number): number {
  if (total <= 1) return 50;
  const step = 70 / (total - 1);
  return 15 + index * step;
}

export default function ServiceMiniDependencyGraph({
  serviceName,
  spans,
  onPeerServiceClick,
}: ServiceMiniDependencyGraphProps) {
  const theme = useEChartTheme();
  const instanceRef = useRef<EChartInstance | undefined>(undefined);

  const { neighbors, maxCalls } = useMemo(() => {
    const graph = buildServiceMapData(spans);
    const rows: NeighborEdge[] = graph.edges
      .filter((edge) => edge.source === serviceName || edge.target === serviceName)
      .map((edge) => ({
        direction: edge.source === serviceName ? "outbound" : "inbound",
        peerService: edge.source === serviceName ? edge.target : edge.source,
        calls: edge.callCount,
        errorRate: edge.callCount > 0 ? edge.errorCount / edge.callCount : 0,
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);
    return { neighbors: rows, maxCalls: Math.max(1, ...rows.map((r) => r.calls)) };
  }, [serviceName, spans]);

  const option = useMemo(() => {
    const inbound = neighbors.filter((n) => n.direction === "inbound");
    const outbound = neighbors.filter((n) => n.direction === "outbound");

    const nodes: Array<Record<string, unknown>> = [
      {
        id: serviceName,
        name: serviceName,
        x: 50,
        y: 50,
        symbolSize: 42,
        itemStyle: { color: "#1976d2", borderColor: "rgba(255,255,255,0.8)", borderWidth: 2 },
        label: { color: "inherit", fontWeight: 700 },
      },
    ];

    inbound.forEach((edge, i) => {
      nodes.push({
        id: edge.peerService,
        name: edge.peerService,
        x: 18,
        y: distributeY(i, inbound.length),
        symbolSize: 26,
        itemStyle: { color: "#4c7cd6", borderColor: "rgba(255,255,255,0.5)", borderWidth: 1.5 },
        label: { color: "inherit", fontWeight: 500 },
      });
    });
    outbound.forEach((edge, i) => {
      nodes.push({
        id: edge.peerService,
        name: edge.peerService,
        x: 82,
        y: distributeY(i, outbound.length),
        symbolSize: 26,
        itemStyle: { color: "#5b92ff", borderColor: "rgba(255,255,255,0.5)", borderWidth: 1.5 },
        label: { color: "inherit", fontWeight: 500 },
      });
    });

    const links = neighbors.map((edge) => ({
      source: edge.direction === "inbound" ? edge.peerService : serviceName,
      target: edge.direction === "inbound" ? serviceName : edge.peerService,
      lineStyle: {
        width: 1.5 + (edge.calls / maxCalls) * 3.5,
        color: edge.errorRate > 0.05 ? "#d32f2f" : "rgba(120,160,255,0.8)",
        opacity: 0.85,
        curveness: 0.08,
      },
      label: { show: false },
      value: edge.calls,
    }));

    return {
      animation: false,
      tooltip: {
        trigger: "item",
      },
      series: [
        {
          type: "graph",
          layout: "none",
          coordinateSystem: null,
          roam: false,
          edgeSymbol: ["none", "arrow"],
          edgeSymbolSize: 8,
          label: { show: true, position: "bottom", fontSize: 11, distance: 4 },
          data: nodes,
          links,
        },
      ],
    };
  }, [neighbors, maxCalls, serviceName]);

  const handleClick = useCallback(
    (params: { data: { name?: unknown } }) => {
      if (!onPeerServiceClick) return;
      const clicked = params?.data?.name;
      if (typeof clicked !== "string" || clicked === serviceName) return;
      onPeerServiceClick(clicked);
    },
    [onPeerServiceClick, serviceName],
  );

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !onPeerServiceClick) return;
    instance.on("click", handleClick);
    return () => instance.off("click", handleClick);
  }, [handleClick, onPeerServiceClick]);

  if (neighbors.length === 0) {
    return (
      <EmptyState
        size="small"
        heading="No direct dependencies in scope"
        description="No inbound or outbound peers were found for this service in the selected window."
      />
    );
  }

  return (
    <EChart
      option={option}
      theme={theme}
      _instance={instanceRef}
      sx={{ width: "100%", height: "100%" }}
    />
  );
}
