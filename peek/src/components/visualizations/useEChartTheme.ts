import { useContext } from "react";
import { useTheme } from "@mui/material/styles";

import { CHART_COLORS, CHART_TOOLTIP_BG_DARK, CHART_TOOLTIP_BG_LIGHT } from "../../theme";
import { PeekChartsThemeContext } from "../perses/PeekChartsThemeContext";

/**
 * Returns ECharts-compatible theme options that match the current MUI theme.
 *
 * When rendered inside {@link PersesProviders} the theme is derived from the
 * centrally-managed `PersesChartsTheme`.  Otherwise it falls back to an
 * equivalent inline theme built from the MUI palette — so existing chart
 * components work both inside and outside the provider hierarchy.
 */
export function useEChartTheme() {
  const theme = useTheme();
  const persesTheme = useContext(PeekChartsThemeContext);
  const isDark = theme.palette.mode === "dark";

  if (persesTheme) {
    const { echartsTheme } = persesTheme;
    return {
      color: (echartsTheme.color ?? CHART_COLORS) as string[],
      backgroundColor: (echartsTheme.backgroundColor ?? "transparent") as string,
      textStyle: echartsTheme.textStyle ?? {
        color: theme.palette.text.secondary,
        fontFamily: theme.typography.fontFamily,
        fontSize: 11,
      },
      title: echartsTheme.title ?? { textStyle: { color: theme.palette.text.primary } },
      legend: echartsTheme.legend ?? { textStyle: { color: theme.palette.text.secondary } },
      tooltip: echartsTheme.tooltip ?? {
        backgroundColor: isDark ? CHART_TOOLTIP_BG_DARK : CHART_TOOLTIP_BG_LIGHT,
        borderColor: theme.palette.divider,
        textStyle: { color: theme.palette.text.primary, fontSize: 12 },
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
