import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { EChart } from "@perses-dev/components";

import { COMPONENT_HEIGHTS } from "../../types/tokens";
import { useEChartTheme } from "../visualizations/useEChartTheme";

import type { SparklinePoint } from "./serviceInventoryHelpers";

interface ServiceSparklineCellProps {
  data: SparklinePoint[];
  color?: string;
}

function buildInlineSparkline(
  data: SparklinePoint[],
  themeOpts: ReturnType<typeof useEChartTheme>,
  lineColor: string,
): Record<string, unknown> {
  if (data.length === 0) {
    return {};
  }
  return {
    ...themeOpts,
    grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false },
    xAxis: { type: "time", show: false },
    yAxis: { type: "value", show: false, min: "dataMin" },
    tooltip: { show: false },
    series: [
      {
        type: "line",
        data,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5 },
        areaStyle: { opacity: 0.15 },
        itemStyle: { color: lineColor },
      },
    ],
  };
}

export default function ServiceSparklineCell({ data, color }: ServiceSparklineCellProps) {
  const theme = useTheme();
  const echartsTheme = useEChartTheme();
  const lineColor = color ?? theme.palette.primary.main;

  if (data.length === 0) {
    return null;
  }

  return (
    <Box sx={{ flexShrink: 0, width: 80, height: COMPONENT_HEIGHTS.buttonSmall }}>
      <EChart
        option={buildInlineSparkline(data, echartsTheme, lineColor)}
        theme={echartsTheme}
        sx={{ width: "100%", height: "100%" }}
      />
    </Box>
  );
}
