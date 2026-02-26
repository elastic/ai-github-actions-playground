import { useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

import type { FlamegraphNode } from "../profiling/profilingUtils";

import EChartWrapper from "./EChartWrapper";
import { escapeHtml } from "./htmlUtils";

interface Props {
  tree: FlamegraphNode;
  onFrameClick?: (frameName: string) => void;
}

interface FlatRect {
  name: string;
  depth: number;
  start: number;
  width: number;
}

function flattenTree(node: FlamegraphNode, depth: number, start: number): FlatRect[] {
  const rects: FlatRect[] = [];
  if (depth > 0) {
    rects.push({ name: node.name, depth, start, width: node.value });
  }
  let offset = start;
  for (const child of node.children) {
    rects.push(...flattenTree(child, depth + 1, offset));
    offset += child.value;
  }
  return rects;
}

const FLAMEGRAPH_COLORS = [
  "#e25822",
  "#e8702a",
  "#ed8733",
  "#f29d3b",
  "#f7b344",
  "#fcc94c",
  "#d64f1f",
  "#c14618",
  "#f0a030",
  "#e06020",
];

function getFlameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return FLAMEGRAPH_COLORS[Math.abs(hash) % FLAMEGRAPH_COLORS.length]!;
}

const MIN_LABEL_WIDTH = 30;
const TEXT_PADDING = 6;

export default function ProfilingFlamegraph({ tree, onFrameClick }: Props) {
  const muiTheme = useTheme();

  const option = useMemo(() => {
    if (tree.value === 0) return null;
    const rects = flattenTree(tree, 0, 0);
    const maxDepth = rects.reduce((max, r) => Math.max(max, r.depth), 0);
    const totalSamples = tree.value;

    return {
      tooltip: {
        trigger: "item" as const,
        formatter: (params: { data: { rect: FlatRect } }) => {
          const rect = params.data.rect;
          const pct = ((rect.width / totalSamples) * 100).toFixed(1);
          return `<b>${escapeHtml(rect.name)}</b><br/>Samples: ${rect.width} (${pct}%)`;
        },
      },
      xAxis: {
        type: "value" as const,
        max: totalSamples,
        show: false,
      },
      yAxis: {
        type: "value" as const,
        max: maxDepth + 1,
        inverse: true,
        show: false,
      },
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      series: [
        {
          type: "custom" as const,
          renderItem: (
            _params: unknown,
            api: {
              value: (dim: number) => number;
              coord: (val: [number, number]) => [number, number];
              size: (val: [number, number]) => [number, number];
              style: (extra?: Record<string, unknown>) => Record<string, unknown>;
            },
          ) => {
            const startVal = api.value(0) as number;
            const widthVal = api.value(1) as number;
            const depthVal = api.value(2) as number;
            const name = api.value(3) as unknown as string;
            const [x, y] = api.coord([startVal, depthVal]);
            const [w, h] = api.size([widthVal, 1]);
            return {
              type: "rect" as const,
              shape: { x, y, width: Math.max(w - 1, 1), height: Math.max(h - 2, 1) },
              style: api.style({
                fill: getFlameColor(String(name)),
                stroke: muiTheme.palette.background.paper,
                lineWidth: 0.5,
              }),
              textContent: {
                type: "text" as const,
                style: {
                  text: w > MIN_LABEL_WIDTH ? String(name) : "",
                  fill: "#fff",
                  fontSize: 11,
                  truncate: { outerWidth: Math.max(w - TEXT_PADDING, 0) },
                },
              },
              textConfig: { position: "inside" as const, inside: true },
            };
          },
          encode: { x: [0, 1], y: 2 },
          data: rects.map((rect) => ({
            value: [rect.start, rect.width, rect.depth, rect.name],
            rect,
          })),
        },
      ],
    };
  }, [tree, muiTheme.palette.background.paper]);

  const handleClick = useCallback(
    (params: { data: unknown }) => {
      const data = params.data as { rect?: FlatRect } | undefined;
      if (data?.rect && onFrameClick) {
        onFrameClick(data.rect.name);
      }
    },
    [onFrameClick],
  );

  if (tree.value === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          No flamegraph data available. Run a query to load profiling data.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      <EChartWrapper
        option={option as Record<string, unknown>}
        onClick={handleClick as (params: { dataIndex: number; data: unknown }) => void}
      />
    </Box>
  );
}
