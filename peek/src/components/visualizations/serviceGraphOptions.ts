/**
 * Shared factory for building ECharts graph-series options used by both
 * `TraceServiceMap` and `DriftRadarMap`.
 */
import type { ServiceMapData, ServiceMapEdge, ServiceMapNode } from "../traces/traceUtils";
import { getServiceColor } from "../traces/traceColors";

import { escapeHtml } from "./htmlUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_NODE_SIZE = 36;
const MAX_NODE_SIZE = 60;
const US_TO_MS = 1000;
const MIN_EDGE_WIDTH = 1.5;
const EDGE_WIDTH_SCALE = 0.4;
const MAX_EDGE_WIDTH = 5;
const DEFAULT_ERROR_COLOR = "#BD271E";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-edge overrides returned by the optional `edgeExtras` hook. */
export interface EdgeExtras {
  /** Extra tooltip text appended after the header (e.g. `" [regressed]"`). */
  tooltipSuffix?: string;
  /** Line color override.  Falls back to error-color / `"source"`. */
  color?: string;
  /** Line opacity override.  Defaults to `0.75`. */
  opacity?: number;
  /** Arbitrary extra data fields merged into the link object. */
  data?: Record<string, unknown>;
}

export interface BuildServiceGraphOptions {
  mapData: ServiceMapData;
  /**
   * Color used for error-state borders on nodes and error-state edges.
   * Defaults to `"#BD271E"`.
   */
  errorColor?: string;
  /**
   * Optional hook called once per edge to supply status-specific overlays.
   * When omitted, plain error-based coloring is used (TraceServiceMap style).
   */
  edgeExtras?: (edge: ServiceMapEdge) => EdgeExtras;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildServiceGraphOption(opts: BuildServiceGraphOptions): Record<string, any> {
  const { mapData, errorColor = DEFAULT_ERROR_COLOR, edgeExtras } = opts;
  const maxSpanCount = Math.max(1, ...mapData.nodes.map((node: ServiceMapNode) => node.spanCount));

  return {
    tooltip: {
      trigger: "item",
      formatter: (params: {
        dataType: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: Record<string, any>;
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
          const {
            source,
            target,
            callCount = 0,
            avgLatencyMs = 0,
            _tooltipSuffix = "",
          } = params.data;
          const escapedSource = escapeHtml(source ?? "");
          const escapedTarget = escapeHtml(target ?? "");
          return [
            `<b>${escapedSource} → ${escapedTarget}${_tooltipSuffix}</b>`,
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
        data: mapData.nodes.map((node: ServiceMapNode) => {
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
              borderColor: hasErrors ? errorColor : "rgba(255,255,255,0.4)",
              borderWidth: hasErrors ? 3 : 2,
              shadowBlur: 8,
              shadowColor: "rgba(0,0,0,0.25)",
            },
            emphasis: {
              itemStyle: {
                borderWidth: 4,
                borderColor: hasErrors ? errorColor : "#FFFFFF",
                shadowBlur: 16,
              },
            },
          };
        }),
        links: mapData.edges.map((edge: ServiceMapEdge) => {
          const avgLatencyMs =
            edge.callCount > 0 ? edge.totalDurationUs / edge.callCount / US_TO_MS : 0;
          const hasErrors = edge.errorCount > 0;
          const extras = edgeExtras?.(edge);
          return {
            source: edge.source,
            target: edge.target,
            value: edge.callCount,
            callCount: edge.callCount,
            avgLatencyMs,
            _tooltipSuffix: extras?.tooltipSuffix ?? "",
            ...extras?.data,
            lineStyle: {
              width: Math.max(
                MIN_EDGE_WIDTH,
                Math.min(MIN_EDGE_WIDTH + edge.callCount * EDGE_WIDTH_SCALE, MAX_EDGE_WIDTH),
              ),
              color: extras?.color ?? (hasErrors ? errorColor : "source"),
              opacity: extras?.opacity ?? 0.75,
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
}
