import { useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import type { Span } from "../traces/traceUtils";
import { buildServiceMapData } from "../traces/traceUtils";
import { getServiceColor } from "../traces/traceColors";

import EChartWrapper from "./EChartWrapper";

interface Props {
  spans: Span[];
  onNodeClick?: (serviceName: string) => void;
}

const MIN_NODE_SIZE = 36;
const MAX_NODE_SIZE = 60;
const ERROR_COLOR = "#BD271E";
const US_TO_MS = 1000;
const MIN_EDGE_WIDTH = 1.5;
const EDGE_WIDTH_SCALE = 0.4;
const MAX_EDGE_WIDTH = 5;

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

export default function TraceServiceMap({ spans, onNodeClick }: Props) {
  const mapData = useMemo(() => buildServiceMapData(spans), [spans]);

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
            const { source, target, callCount = 0, avgLatencyMs = 0 } = params.data;
            const escapedSource = escapeHtml(source ?? "");
            const escapedTarget = escapeHtml(target ?? "");
            return [
              `<b>${escapedSource} → ${escapedTarget}</b>`,
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
            // Higher repulsion and variable edge length keep nodes well-spaced
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
                borderColor: hasErrors ? ERROR_COLOR : "rgba(255,255,255,0.4)",
                borderWidth: hasErrors ? 3 : 2,
                shadowBlur: 8,
                shadowColor: "rgba(0,0,0,0.25)",
              },
              emphasis: {
                itemStyle: {
                  borderWidth: 4,
                  borderColor: hasErrors ? ERROR_COLOR : "#FFFFFF",
                  shadowBlur: 16,
                },
              },
            };
          }),
          links: mapData.edges.map((edge) => {
            const avgLatencyMs =
              edge.callCount > 0 ? edge.totalDurationUs / edge.callCount / US_TO_MS : 0;
            const hasErrors = edge.errorCount > 0;
            return {
              source: edge.source,
              target: edge.target,
              value: edge.callCount,
              callCount: edge.callCount,
              avgLatencyMs,
              lineStyle: {
                width: Math.max(
                  MIN_EDGE_WIDTH,
                  Math.min(MIN_EDGE_WIDTH + edge.callCount * EDGE_WIDTH_SCALE, MAX_EDGE_WIDTH),
                ),
                color: hasErrors ? ERROR_COLOR : "source",
                opacity: 0.75,
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
  }, [mapData.edges, mapData.nodes]);

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
          No cross-service dependencies found for this trace
        </Typography>
      </Box>
    );
  }

  return <EChartWrapper option={option} onClick={handleClick} />;
}
