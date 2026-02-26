import { useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";

import type { Span, ServiceMapEdge } from "../traces/traceUtils";
import { buildServiceMapData } from "../traces/traceUtils";
import { getServiceColor } from "../traces/traceColors";

import EChartWrapper from "./EChartWrapper";
import { escapeHtml } from "./htmlUtils";

interface Props {
  currentSpans: Span[];
  baselineSpans?: Span[];
  onNodeClick?: (serviceName: string) => void;
}

type EdgeStatus = "new" | "regressed" | "improved" | "stable";

/** Display order for the legend chips and classification comparisons. */
const EDGE_STATUS_ORDER: EdgeStatus[] = ["new", "regressed", "improved", "stable"];

const MIN_NODE_SIZE = 36;
const MAX_NODE_SIZE = 60;
const US_TO_MS = 1000;
const MIN_EDGE_WIDTH = 1.5;
const EDGE_WIDTH_SCALE = 0.4;
const MAX_EDGE_WIDTH = 5;

const EDGE_STATUS_COLOR: Record<EdgeStatus, string> = {
  new: "#0077CC",
  regressed: "#BD271E",
  improved: "#00BFB3",
  stable: "#888888",
};

function classifyEdge(current: ServiceMapEdge, baseline?: ServiceMapEdge): EdgeStatus {
  if (!baseline) return "new";

  const currentErrorRate = current.callCount > 0 ? current.errorCount / current.callCount : 0;
  const baselineErrorRate = baseline.callCount > 0 ? baseline.errorCount / baseline.callCount : 0;

  const currentAvgUs = current.callCount > 0 ? current.totalDurationUs / current.callCount : 0;
  const baselineAvgUs = baseline.callCount > 0 ? baseline.totalDurationUs / baseline.callCount : 0;

  const errorRateDiff = currentErrorRate - baselineErrorRate;
  const latencyRatio = baselineAvgUs > 0 ? (currentAvgUs - baselineAvgUs) / baselineAvgUs : 0;

  if (errorRateDiff > 0.05 || latencyRatio > 0.2) return "regressed";
  if (errorRateDiff < -0.05 || latencyRatio < -0.2) return "improved";
  return "stable";
}

export default function DriftRadarMap({ currentSpans, baselineSpans, onNodeClick }: Props) {
  const mapData = useMemo(() => buildServiceMapData(currentSpans), [currentSpans]);
  const baselineMapData = useMemo(
    () => (baselineSpans ? buildServiceMapData(baselineSpans) : null),
    [baselineSpans],
  );

  const baselineEdgeMap = useMemo(() => {
    if (!baselineMapData) return null;
    const m = new Map<string, ServiceMapEdge>();
    for (const edge of baselineMapData.edges) {
      m.set(`${edge.source}→${edge.target}`, edge);
    }
    return m;
  }, [baselineMapData]);

  const edgeStatuses = useMemo<Map<string, EdgeStatus>>(() => {
    const result = new Map<string, EdgeStatus>();
    for (const edge of mapData.edges) {
      const key = `${edge.source}→${edge.target}`;
      if (!baselineEdgeMap) {
        result.set(key, "stable");
        continue;
      }
      const baselineEdge = baselineEdgeMap?.get(key);
      result.set(key, classifyEdge(edge, baselineEdge));
    }
    return result;
  }, [mapData.edges, baselineEdgeMap]);

  const legendStatuses = useMemo<EdgeStatus[]>(() => {
    const seen = new Set<EdgeStatus>();
    for (const status of edgeStatuses.values()) {
      seen.add(status);
    }
    return EDGE_STATUS_ORDER.filter((s) => seen.has(s));
  }, [edgeStatuses]);

  const legendLabel: Record<EdgeStatus, string> = {
    new: "New edge",
    regressed: "Regressed",
    improved: "Improved",
    stable: "Stable",
  };

  const option = useMemo(() => {
    const maxSpanCount = Math.max(1, ...mapData.nodes.map((node) => node.spanCount));

    return {
      tooltip: {
        trigger: "item",
        formatter: (params: {
          dataType: string;
          data: {
            name?: string;
            value?: number;
            errorCount?: number;
            callCount?: number;
            avgLatencyMs?: number;
            edgeStatus?: EdgeStatus;
            source?: string;
            target?: string;
          };
        }) => {
          if (params.dataType === "node") {
            const { name, value = 0, errorCount = 0 } = params.data;
            const errorRate = value > 0 ? ((errorCount / value) * 100).toFixed(1) : "0.0";
            const escapedName = escapeHtml(name ?? "");
            return [
              `<b>${escapedName}</b>`,
              `Spans: ${value}`,
              `Errors: ${errorCount} (${errorRate}%)`,
            ].join("<br/>");
          }
          if (params.dataType === "edge") {
            const { source, target, callCount = 0, avgLatencyMs = 0, edgeStatus } = params.data;
            const escapedSource = escapeHtml(source ?? "");
            const escapedTarget = escapeHtml(target ?? "");
            const statusLabel = edgeStatus ? ` [${edgeStatus}]` : "";
            return [
              `<b>${escapedSource} → ${escapedTarget}${statusLabel}</b>`,
              `Calls: ${callCount}`,
              `Avg latency: ${avgLatencyMs.toFixed(1)} ms`,
            ].join("<br/>");
          }
          return "";
        },
      },
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          force: {
            repulsion: 350,
            edgeLength: [120, 200],
            gravity: 0.12,
            friction: 0.6,
          },
          label: {
            show: true,
            position: "bottom",
            fontSize: 12,
            fontWeight: 600,
            distance: 6,
            color: "inherit",
          },
          edgeSymbol: ["none", "arrow"],
          edgeSymbolSize: 10,
          data: mapData.nodes.map((node) => {
            const hasErrors = node.errorCount > 0;
            const baseColor = getServiceColor(node.serviceName);
            const size =
              MIN_NODE_SIZE + (node.spanCount / maxSpanCount) * (MAX_NODE_SIZE - MIN_NODE_SIZE);
            return {
              id: node.serviceName,
              name: node.serviceName,
              value: node.spanCount,
              errorCount: node.errorCount,
              symbolSize: size,
              itemStyle: {
                color: baseColor,
                borderColor: hasErrors ? EDGE_STATUS_COLOR.regressed : "rgba(255,255,255,0.4)",
                borderWidth: hasErrors ? 3 : 2,
                shadowBlur: 8,
                shadowColor: "rgba(0,0,0,0.25)",
              },
              emphasis: {
                itemStyle: {
                  borderWidth: 4,
                  borderColor: hasErrors ? EDGE_STATUS_COLOR.regressed : "#FFFFFF",
                  shadowBlur: 16,
                },
              },
            };
          }),
          links: mapData.edges.map((edge) => {
            const avgLatencyMs =
              edge.callCount > 0 ? edge.totalDurationUs / edge.callCount / US_TO_MS : 0;
            const key = `${edge.source}→${edge.target}`;
            const status = edgeStatuses.get(key) ?? "stable";
            const edgeColor = EDGE_STATUS_COLOR[status];
            return {
              source: edge.source,
              target: edge.target,
              value: edge.callCount,
              callCount: edge.callCount,
              avgLatencyMs,
              edgeStatus: status,
              lineStyle: {
                width: Math.max(
                  MIN_EDGE_WIDTH,
                  Math.min(MIN_EDGE_WIDTH + edge.callCount * EDGE_WIDTH_SCALE, MAX_EDGE_WIDTH),
                ),
                color: edgeColor,
                opacity: 0.85,
                curveness: 0.2,
              },
              label: {
                show: true,
                formatter: String(edge.callCount),
                fontSize: 11,
                fontWeight: 500,
                backgroundColor: "rgba(0,0,0,0.45)",
                color: "#FFFFFF",
                padding: [2, 5],
                borderRadius: 4,
              },
            };
          }),
          emphasis: {
            focus: "adjacency",
            lineStyle: { width: 4 },
          },
        },
      ],
    };
  }, [mapData.edges, mapData.nodes, edgeStatuses]);

  const handleClick = useCallback(
    (params: { data: unknown }) => {
      if (!onNodeClick || !params.data || typeof params.data !== "object") return;
      const data = params.data as { name?: unknown };
      if (typeof data.name === "string") {
        onNodeClick(data.name);
      }
    },
    [onNodeClick],
  );

  if (mapData.edges.length === 0) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <Typography variant="body2" color="text.secondary">
          No cross-service dependencies found in this time window
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {legendStatuses.length > 0 && (
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", px: 1.5, pt: 1 }}>
          {legendStatuses.map((status) => (
            <Chip
              key={status}
              size="small"
              label={legendLabel[status]}
              sx={{
                borderLeft: `4px solid ${EDGE_STATUS_COLOR[status]}`,
                fontSize: "0.7rem",
              }}
            />
          ))}
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <EChartWrapper option={option} onClick={handleClick} />
      </Box>
    </Box>
  );
}
