import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

import { COMPONENT_HEIGHTS } from "../../types/tokens";

import type { SparklinePoint } from "./serviceInventoryHelpers";

interface ServiceSparklineCellProps {
  data: SparklinePoint[];
  color?: string;
}

function buildSparklinePath(data: SparklinePoint[], width: number, height: number): string {
  if (data.length === 0) return "";
  const xMin = data[0]![0];
  const xMax = data[data.length - 1]![0];
  const yValues = data.map(([, v]) => v);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const xSpan = Math.max(1, xMax - xMin);
  const ySpan = Math.max(1, yMax - yMin);

  return data
    .map(([x, y], i) => {
      const px = ((x - xMin) / xSpan) * width;
      const py = height - ((y - yMin) / ySpan) * height;
      return `${i === 0 ? "M" : "L"}${px.toFixed(2)},${py.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(
  data: SparklinePoint[],
  width: number,
  height: number,
  linePath: string,
): string {
  if (data.length === 0 || linePath.length === 0) return "";
  const xMin = data[0]![0];
  const xMax = data[data.length - 1]![0];
  const xSpan = Math.max(1, xMax - xMin);
  const firstX = (((data[0]![0] - xMin) / xSpan) * width).toFixed(2);
  const lastX = (((data[data.length - 1]![0] - xMin) / xSpan) * width).toFixed(2);
  return `${linePath} L${lastX},${height.toFixed(2)} L${firstX},${height.toFixed(2)} Z`;
}

function sortByTimestamp(data: SparklinePoint[]): SparklinePoint[] {
  if (data.length < 2) return data;
  const sorted = [...data].sort((a, b) => a[0] - b[0]);
  return sorted;
}

export default function ServiceSparklineCell({ data, color }: ServiceSparklineCellProps) {
  const theme = useTheme();
  const lineColor = color ?? theme.palette.primary.main;
  const width = 80;
  const height = 24;
  const sorted = sortByTimestamp(data);
  const hasData = sorted.length > 0;
  const linePath = hasData
    ? buildSparklinePath(sorted, width, height)
    : `M0,${(height / 2).toFixed(2)} L${width},${(height / 2).toFixed(2)}`;
  const areaPath = hasData ? buildAreaPath(sorted, width, height, linePath) : "";

  return (
    <Box sx={{ flexShrink: 0, width: 80, height: COMPONENT_HEIGHTS.buttonSmall }}>
      <Box
        component="svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={hasData ? "Trend sparkline" : "Trend unavailable"}
        sx={{ display: "block", width: "100%", height: "100%" }}
      >
        {hasData && (
          <Box
            component="path"
            d={areaPath}
            sx={{
              opacity: 0.15,
              fill: lineColor,
            }}
          />
        )}
        <Box
          component="path"
          d={linePath}
          sx={{
            opacity: hasData ? 1 : 0.7,
            fill: "none",
            stroke: hasData ? lineColor : "text.disabled",
            strokeDasharray: hasData ? "none" : "3 2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: hasData ? 1.5 : 1,
          }}
        />
      </Box>
    </Box>
  );
}
