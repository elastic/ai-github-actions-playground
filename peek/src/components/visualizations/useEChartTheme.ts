import { useTheme } from "@mui/material/styles";
import { CHART_COLORS, CHART_TOOLTIP_BG_DARK, CHART_TOOLTIP_BG_LIGHT } from "../../theme";

/**
 * Returns ECharts-compatible theme options that match the current MUI theme.
 * Inspired by Perses's generateChartsTheme utility.
 */
export function useEChartTheme() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return {
    color: CHART_COLORS,
    backgroundColor: "transparent",
    textStyle: {
      color: theme.palette.text.secondary,
      fontFamily: theme.typography.fontFamily,
      fontSize: 11,
    },
    title: {
      textStyle: { color: theme.palette.text.primary },
    },
    legend: {
      textStyle: { color: theme.palette.text.secondary },
    },
    tooltip: {
      backgroundColor: isDark ? CHART_TOOLTIP_BG_DARK : CHART_TOOLTIP_BG_LIGHT,
      borderColor: theme.palette.divider,
      textStyle: {
        color: theme.palette.text.primary,
        fontSize: 12,
      },
    },
    xAxis: {
      axisLine: { lineStyle: { color: theme.palette.divider } },
      splitLine: { lineStyle: { color: theme.palette.divider, opacity: 0.4 } },
      axisLabel: { color: theme.palette.text.secondary },
    },
    yAxis: {
      axisLine: { lineStyle: { color: theme.palette.divider } },
      splitLine: { lineStyle: { color: theme.palette.divider, opacity: 0.4 } },
      axisLabel: { color: theme.palette.text.secondary },
    },
  };
}
