import { useMemo } from "react";
import { useTheme } from "@mui/material/styles";
import { ChartsProvider, TimeZoneProvider, generateChartsTheme } from "@perses-dev/components";
import type { PersesChartsTheme } from "@perses-dev/components";

import { CHART_COLORS, CHART_TOOLTIP_BG_DARK, CHART_TOOLTIP_BG_LIGHT } from "../../theme";

import { PeekChartsThemeContext } from "./PeekChartsThemeContext";

interface Props {
  /** Dashboard timezone (IANA zone or undefined for browser local). */
  timeZone?: string;
  children: React.ReactNode;
}

/**
 * Wraps children with Perses's ChartsProvider and TimeZoneProvider so that
 * all chart components can read a centrally-managed ECharts theme and timezone.
 */
export default function PersesProviders({ timeZone, children }: Props) {
  const muiTheme = useTheme();

  const chartsTheme = useMemo<PersesChartsTheme>(() => {
    const isDark = muiTheme.palette.mode === "dark";
    return generateChartsTheme(muiTheme, {
      echartsTheme: {
        color: CHART_COLORS,
        backgroundColor: "transparent",
        textStyle: {
          color: muiTheme.palette.text.secondary,
          fontFamily: muiTheme.typography.fontFamily as string,
          fontSize: 11,
        },
        title: {
          textStyle: { color: muiTheme.palette.text.primary },
        },
        legend: {
          textStyle: { color: muiTheme.palette.text.secondary },
        },
        tooltip: {
          backgroundColor: isDark ? CHART_TOOLTIP_BG_DARK : CHART_TOOLTIP_BG_LIGHT,
          borderColor: muiTheme.palette.divider,
          textStyle: {
            color: muiTheme.palette.text.primary,
            fontSize: 12,
          },
        },
      },
    });
  }, [muiTheme]);

  return (
    <ChartsProvider chartsTheme={chartsTheme}>
      <PeekChartsThemeContext.Provider value={chartsTheme}>
        <TimeZoneProvider timeZone={timeZone}>{children}</TimeZoneProvider>
      </PeekChartsThemeContext.Provider>
    </ChartsProvider>
  );
}
