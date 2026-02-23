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

export default function TraceServiceMap({ spans, onNodeClick }: Props) {
  const mapData = useMemo(() => buildServiceMapData(spans), [spans]);

  const option = useMemo(() => {
    const maxSpanCount = Math.max(1, ...mapData.nodes.map((node) => node.spanCount));
    return {
      tooltip: {
        trigger: "item",
      },
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          force: {
            repulsion: 220,
            edgeLength: 140,
          },
          label: {
            show: true,
            position: "right",
          },
          data: mapData.nodes.map((node) => ({
            id: node.serviceName,
            name: node.serviceName,
            value: node.spanCount,
            symbolSize: 24 + (node.spanCount / maxSpanCount) * 24,
            itemStyle: {
              color: getServiceColor(node.serviceName),
            },
          })),
          links: mapData.edges.map((edge) => ({
            source: edge.source,
            target: edge.target,
            value: edge.callCount,
            lineStyle: {
              width: 1 + Math.min(edge.callCount, 5),
              opacity: 0.7,
            },
            label: {
              show: true,
              formatter: String(edge.callCount),
            },
          })),
          lineStyle: {
            curveness: 0.15,
          },
          emphasis: {
            focus: "adjacency",
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
