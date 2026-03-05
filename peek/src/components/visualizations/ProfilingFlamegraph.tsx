import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import ClearIcon from "@mui/icons-material/Clear";
import FilterListIcon from "@mui/icons-material/FilterList";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SearchIcon from "@mui/icons-material/Search";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import { EChart } from "@perses-dev/components";

import type { FlamegraphNode, FrameType } from "../profiling/profilingUtils";
import { findSubtreeByPath } from "../profiling/profilingUtils";
import { CHART_COLORS } from "../../theme";
import { STATUS_COLORS } from "../../types/tokens";

import { useEChartTheme } from "./useEChartTheme";
import { escapeHtml } from "./htmlUtils";
import type { EChartInstance } from "./chartExport";

interface Props {
  tree: FlamegraphNode;
  onFrameClick?: (frameName: string) => void;
}

interface FlatRect {
  name: string;
  depth: number;
  start: number;
  width: number;
  path: string[];
  frameType: FrameType;
}

function flattenTree(
  node: FlamegraphNode,
  depth: number,
  start: number,
  pathPrefix: string[],
): FlatRect[] {
  const rects: FlatRect[] = [];
  flattenTreeInto(rects, node, depth, start, pathPrefix);
  return rects;
}

function flattenTreeInto(
  rects: FlatRect[],
  node: FlamegraphNode,
  depth: number,
  start: number,
  pathPrefix: string[],
): void {
  const isZoomedRoot = depth === 0 && pathPrefix.length > 0;
  if (depth > 0 || isZoomedRoot) {
    rects.push({
      name: node.name,
      depth,
      start,
      width: node.value,
      path: pathPrefix,
      frameType: node.frameType ?? "app",
    });
  }
  let offset = start;
  for (const child of node.children) {
    const childPath = [...pathPrefix, child.name];
    flattenTreeInto(rects, child, depth + 1, offset, childPath);
    offset += child.value;
  }
}

const FRAME_TYPE_COLORS: Record<FrameType, string[]> = {
  kernel: [
    STATUS_COLORS.error,
    CHART_COLORS[9] ?? STATUS_COLORS.warning,
    CHART_COLORS[2] ?? STATUS_COLORS.error,
    CHART_COLORS[3] ?? STATUS_COLORS.warning,
  ],
  runtime: [
    STATUS_COLORS.warning,
    CHART_COLORS[8] ?? STATUS_COLORS.warning,
    CHART_COLORS[3] ?? STATUS_COLORS.warning,
    CHART_COLORS[1] ?? STATUS_COLORS.inProgress,
  ],
  native: [
    CHART_COLORS[10] ?? STATUS_COLORS.info,
    CHART_COLORS[0] ?? STATUS_COLORS.info,
    CHART_COLORS[4] ?? STATUS_COLORS.info,
    CHART_COLORS[11] ?? STATUS_COLORS.info,
  ],
  interpreted: [
    CHART_COLORS[4] ?? STATUS_COLORS.info,
    CHART_COLORS[6] ?? STATUS_COLORS.info,
    CHART_COLORS[10] ?? STATUS_COLORS.info,
    CHART_COLORS[0] ?? STATUS_COLORS.info,
  ],
  app: [
    STATUS_COLORS.success,
    CHART_COLORS[7] ?? STATUS_COLORS.success,
    CHART_COLORS[1] ?? STATUS_COLORS.success,
    CHART_COLORS[11] ?? STATUS_COLORS.success,
  ],
};

const DIMMED_OPACITY = 0.25;

function getFlameColor(name: string, frameType: FrameType): string {
  const palette = FRAME_TYPE_COLORS[frameType];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(hash) % palette.length]!;
}

const MIN_LABEL_WIDTH = 30;
const TEXT_PADDING = 6;
/** Approximate character width for font-size 11px. Used for manual truncation. */
const APPROX_CHAR_WIDTH = 6.5;
/** Frames below this fraction of total samples are considered "small". */
const SMALL_FRAME_THRESHOLD = 0.001;
/** Regex for names that represent unknown/unresolved symbols. */
const UNKNOWN_NAME_RE = /^(\(unknown\)|<unknown>|unknown|\?|<\?>)$/i;

export default function ProfilingFlamegraph({ tree, onFrameClick }: Props) {
  const muiTheme = useTheme();
  const theme = useEChartTheme();
  const instanceRef = useRef<EChartInstance | undefined>(undefined);
  const [zoomPath, setZoomPath] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [hideSmallFrames, setHideSmallFrames] = useState(false);
  const [hideUnknownFrames, setHideUnknownFrames] = useState(false);
  const [prevTree, setPrevTree] = useState(tree);
  if (prevTree !== tree) {
    setPrevTree(tree);
    setZoomPath([]);
  }

  const visibleTree = useMemo(() => findSubtreeByPath(tree, zoomPath), [tree, zoomPath]);

  const option = useMemo(() => {
    if (visibleTree.value === 0) return null;
    let rects = flattenTree(visibleTree, 0, 0, zoomPath);
    const totalSamples = visibleTree.value;
    const lowerSearch = searchTerm.toLowerCase();

    if (hideSmallFrames) {
      rects = rects.filter((r) => r.width / totalSamples >= SMALL_FRAME_THRESHOLD);
    }
    if (hideUnknownFrames) {
      rects = rects.filter((r) => !UNKNOWN_NAME_RE.test(r.name));
    }
    if (rects.length === 0) {
      return {
        xAxis: {
          type: "value" as const,
          max: totalSamples,
          show: false,
        },
        yAxis: {
          type: "value" as const,
          max: 1,
          inverse: true,
          show: false,
        },
        grid: { left: 0, right: 0, top: 0, bottom: 0 },
        graphic: {
          type: "text",
          left: "center",
          top: "middle",
          style: {
            text: "No frames to display - filters may be hiding results.",
            fill: muiTheme.palette.text.secondary,
            fontSize: 12,
          },
        },
        series: [],
      };
    }
    const maxDepth = rects.reduce((max, r) => Math.max(max, r.depth), 0);

    return {
      tooltip: {
        trigger: "item" as const,
        formatter: (params: { data: { rect: FlatRect } }) => {
          const rect = params.data.rect;
          const pct = ((rect.width / totalSamples) * 100).toFixed(1);
          return `<b>${escapeHtml(rect.name)}</b><br/>Samples: ${rect.width.toLocaleString()} (${pct}%)<br/><span style="color:#999">Click to zoom in</span>`;
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
            const frameType = api.value(4) as unknown as FrameType;
            const [x, y] = api.coord([startVal, depthVal]);
            const [w, h] = api.size([widthVal, 1]);

            const isMatch =
              lowerSearch.length > 0 && String(name).toLowerCase().includes(lowerSearch);
            const isDimmed = lowerSearch.length > 0 && !isMatch;

            return {
              type: "rect" as const,
              shape: { x, y, width: Math.max(w - 1, 1), height: Math.max(h - 2, 1) },
              style: api.style({
                fill: getFlameColor(String(name), frameType),
                stroke: isMatch ? muiTheme.palette.primary.main : muiTheme.palette.background.paper,
                lineWidth: isMatch ? 2 : 0.5,
                opacity: isDimmed ? DIMMED_OPACITY : 1,
              }),
              textContent: {
                type: "text" as const,
                style: {
                  text: (() => {
                    if (w <= MIN_LABEL_WIDTH) return "";
                    const available = Math.max(w - TEXT_PADDING, 0);
                    const maxChars = Math.floor(available / APPROX_CHAR_WIDTH);
                    const label = String(name);
                    if (maxChars <= 1) return "";
                    if (label.length <= maxChars) return label;
                    return label.slice(0, maxChars - 1) + "…";
                  })(),
                  fill: "#fff",
                  fontSize: 11,
                  fontFamily: "monospace",
                  opacity: isDimmed ? DIMMED_OPACITY : 1,
                },
              },
              textConfig: { position: "inside" as const, inside: true },
            };
          },
          encode: { x: [0, 1], y: 2 },
          data: rects.map((rect) => ({
            value: [rect.start, rect.width, rect.depth, rect.name, rect.frameType],
            rect,
          })),
        },
      ],
    };
  }, [
    visibleTree,
    muiTheme.palette.background.paper,
    muiTheme.palette.primary.main,
    muiTheme.palette.text,
    searchTerm,
    zoomPath,
    hideSmallFrames,
    hideUnknownFrames,
  ]);

  const handleClick = useCallback((params: { data: unknown }) => {
    const data = params.data as { rect?: FlatRect } | undefined;
    if (!data?.rect) return;
    setZoomPath(data.rect.path);
  }, []);

  const handleBreadcrumbClick = useCallback((index: number) => {
    setZoomPath((prev) => prev.slice(0, index));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomPath([]);
  }, []);

  const handleOpenInQueryLab = useCallback(() => {
    const frameName = zoomPath.length > 0 ? (zoomPath.at(-1) ?? null) : null;
    if (frameName && onFrameClick) {
      onFrameClick(frameName);
    }
  }, [zoomPath, onFrameClick]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !option) return;
    instance.on("click", handleClick);
    return () => {
      instance.off("click", handleClick);
    };
  }, [handleClick, option]);

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
    <Box sx={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
      {/* Toolbar */}
      <Box
        sx={{
          display: "flex",
          flexShrink: 0,
          gap: 1,
          alignItems: "center",
          py: 0.5,
          px: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <TextField
          size="small"
          placeholder="Search frames…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchTerm ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchTerm("")}
                    aria-label="Clear search"
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
          sx={{ width: 240 }}
        />
        <Tooltip title="Hide frames with fewer than 0.1% of total samples">
          <Chip
            icon={<FilterListIcon fontSize="small" />}
            label="Hide small"
            size="small"
            variant={hideSmallFrames ? "filled" : "outlined"}
            color={hideSmallFrames ? "primary" : "default"}
            aria-pressed={hideSmallFrames}
            onClick={() => setHideSmallFrames((v) => !v)}
            sx={{ cursor: "pointer" }}
          />
        </Tooltip>
        <Tooltip title="Hide frames with unresolved or unknown symbol names">
          <Chip
            icon={<HelpOutlineIcon fontSize="small" />}
            label="Hide unknown"
            size="small"
            variant={hideUnknownFrames ? "filled" : "outlined"}
            color={hideUnknownFrames ? "primary" : "default"}
            aria-pressed={hideUnknownFrames}
            onClick={() => setHideUnknownFrames((v) => !v)}
            sx={{ cursor: "pointer" }}
          />
        </Tooltip>
        {zoomPath.length > 0 && (
          <Tooltip title="Reset zoom to show the full flamegraph">
            <IconButton size="small" onClick={handleResetZoom} aria-label="Reset zoom">
              <ZoomOutMapIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {zoomPath.length > 0 && onFrameClick && (
          <Tooltip title="Open the zoomed frame in Query Lab">
            <Typography
              variant="caption"
              component="button"
              onClick={handleOpenInQueryLab}
              sx={{
                ml: "auto",
                py: 0.5,
                px: 1,
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                bgcolor: "transparent",
                color: "primary.main",
                cursor: "pointer",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              Open in Query Lab
            </Typography>
          </Tooltip>
        )}
      </Box>

      {/* Breadcrumb */}
      {zoomPath.length > 0 && (
        <Box sx={{ flexShrink: 0, py: 0.5, px: 1, borderBottom: 1, borderColor: "divider" }}>
          <Breadcrumbs separator="›" sx={{ fontSize: "0.75rem" }}>
            <Link
              component="button"
              variant="caption"
              underline="hover"
              onClick={() => handleBreadcrumbClick(0)}
              sx={{ fontFamily: "monospace" }}
            >
              root
            </Link>
            {zoomPath.map((name, i) =>
              i < zoomPath.length - 1 ? (
                <Link
                  key={i}
                  component="button"
                  variant="caption"
                  underline="hover"
                  onClick={() => handleBreadcrumbClick(i + 1)}
                  sx={{ fontFamily: "monospace" }}
                >
                  {name}
                </Link>
              ) : (
                <Typography
                  key={i}
                  variant="caption"
                  color="text.primary"
                  sx={{ fontFamily: "monospace" }}
                >
                  {name}
                </Typography>
              ),
            )}
          </Breadcrumbs>
        </Box>
      )}

      {/* Chart */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {option ? (
          <EChart
            option={option as Record<string, unknown>}
            theme={theme}
            _instance={instanceRef}
            sx={{ width: "100%", height: "100%", minHeight: 120 }}
          />
        ) : null}
      </Box>
    </Box>
  );
}
