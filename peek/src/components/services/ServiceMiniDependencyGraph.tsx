import { useCallback, useEffect, useMemo, useRef } from "react";
import { alpha, useTheme } from "@mui/material/styles";

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
  const echartTheme = useEChartTheme();
  const muiTheme = useTheme();
  const instanceRef = useRef<EChartInstance | undefined>(undefined);

  const { neighbors, maxCalls } = useMemo(() => {
    const graph = buildServiceMapData(spans);
    const rows: NeighborEdge[] = graph.edges
      .filter((edge) => edge.source === serviceName || edge.target === serviceName)
      .map<NeighborEdge>((edge) => ({
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
    const inboundPeerSet = new Set(inbound.map((edge) => edge.peerService));
    const outboundPeerSet = new Set(outbound.map((edge) => edge.peerService));
    const bidirectionalPeers = Array.from(inboundPeerSet).filter((peer) =>
      outboundPeerSet.has(peer),
    );
    const inboundOnly = inbound.filter((edge) => !outboundPeerSet.has(edge.peerService));
    const outboundOnly = outbound.filter((edge) => !inboundPeerSet.has(edge.peerService));

    const nodes: Array<Record<string, unknown>> = [
      {
        id: serviceName,
        name: serviceName,
        x: 50,
        y: 50,
        symbolSize: 42,
        itemStyle: {
          color: muiTheme.palette.primary.main,
          borderColor: alpha(muiTheme.palette.common.white, 0.8),
          borderWidth: 2,
        },
        label: { color: "inherit", fontWeight: 700 },
      },
    ];

    inboundOnly.forEach((edge, i) => {
      nodes.push({
        id: edge.peerService,
        name: edge.peerService,
        x: 18,
        y: distributeY(i, inboundOnly.length),
        symbolSize: 26,
        itemStyle: {
          color: muiTheme.palette.primary.dark,
          borderColor: alpha(muiTheme.palette.common.white, 0.5),
          borderWidth: 1.5,
        },
        label: { color: "inherit", fontWeight: 500 },
      });
    });

    bidirectionalPeers.forEach((peerService, i) => {
      nodes.push({
        id: peerService,
        name: peerService,
        x: 68,
        y: distributeY(i, bidirectionalPeers.length),
        symbolSize: 30,
        itemStyle: {
          color: muiTheme.palette.secondary.main,
          borderColor: alpha(muiTheme.palette.common.white, 0.5),
          borderWidth: 1.5,
        },
        label: { color: "inherit", fontWeight: 500 },
      });
    });

    outboundOnly.forEach((edge, i) => {
      nodes.push({
        id: edge.peerService,
        name: edge.peerService,
        x: 82,
        y: distributeY(i, outboundOnly.length),
        symbolSize: 26,
        itemStyle: {
          color: muiTheme.palette.primary.light,
          borderColor: alpha(muiTheme.palette.common.white, 0.5),
          borderWidth: 1.5,
        },
        label: { color: "inherit", fontWeight: 500 },
      });
    });

    const links = neighbors.map((edge) => ({
      source: edge.direction === "inbound" ? edge.peerService : serviceName,
      target: edge.direction === "inbound" ? serviceName : edge.peerService,
      lineStyle: {
        width: 1.5 + (edge.calls / maxCalls) * 3.5,
        color:
          edge.errorRate > 0.05
            ? muiTheme.palette.error.main
            : alpha(muiTheme.palette.primary.light, 0.8),
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
  }, [maxCalls, muiTheme.palette, neighbors, serviceName]);

  const handleClick = useCallback(
    (params: unknown) => {
      if (!onPeerServiceClick) return;
      const clicked =
        typeof params === "object" && params !== null && "data" in params
          ? (params.data as { name?: unknown })?.name
          : undefined;
      if (typeof clicked !== "string" || clicked === serviceName) return;
      onPeerServiceClick(clicked);
    },
    [onPeerServiceClick, serviceName],
  );

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !onPeerServiceClick) return;
    instance.on("click", handleClick);
    return () => {
      instance.off("click", handleClick);
    };
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
      theme={echartTheme}
      _instance={instanceRef}
      sx={{ width: "100%", height: "100%" }}
    />
  );
}
