import { useMemo, useRef, useEffect } from "react";
import { formatValue } from "@perses-dev/core";
import type { ECharts } from "echarts/core";

import { EChart } from "../perses/PersesEChartWrapper";
import type { EsqlResponse, TimeSeriesOptions } from "../../types";
import { toTimeSeriesData } from "../../services/perses/dataTransformers";
import { CHART_COLORS } from "../../theme";

import { useEChartTheme } from "./useEChartTheme";
import { createPngExporter } from "./chartExport";
import { findDateColumnIndex } from "./chartUtils";

interface Props {
  data: EsqlResponse;
  options?: TimeSeriesOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
  timeZone?: string;
}

export default function TimeSeriesChart({ data, options, onExportReady, timeZone }: Props) {
  const theme = useEChartTheme();
  const instanceRef = useRef<ECharts | undefined>(undefined);
  const smooth = options?.smooth !== false;
  const showArea = options?.showArea !== false;
  const stacked = options?.stacked === true;
  const format = options?.format;

  // Register the PNG-export capability once the chart instance is available.
  // The `_instance` ref is populated by the Perses EChart component during its
  // useLayoutEffect, which fires before this useEffect.
  useEffect(() => {
    if (!onExportReady) return;
    onExportReady(createPngExporter(instanceRef));
    return () => onExportReady(null);
  }, [onExportReady]);

  const option = useMemo(() => {
    const dateIdx = findDateColumnIndex(data);
    const transformed = toTimeSeriesData(data);
    if (transformed.series.length === 0) {
      return { title: { text: "No numeric data to display", left: "center", top: "center" } };
    }
    const series = transformed.series.map((entry, i) => ({
      name: entry.name,
      type: "line",
      data: entry.values,
      smooth,
      showSymbol: entry.values.length < 50,
      lineStyle: { width: 2 },
      areaStyle:
        showArea && (transformed.series.length === 1 || stacked) ? { opacity: 0.1 } : undefined,
      stack: stacked ? "total" : undefined,
      itemStyle: {
        color: theme.color.length
          ? theme.color[i % theme.color.length]
          : CHART_COLORS[i % CHART_COLORS.length],
      },
    }));

    const tzFormatter =
      dateIdx >= 0 && timeZone
        ? new Intl.DateTimeFormat("en", {
            timeZone,
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : undefined;

    const tzDateFormatter = tzFormatter
      ? (value: number) => tzFormatter.format(new Date(value))
      : undefined;

    return {
      grid: { left: 48, right: 16, top: 32, bottom: dateIdx >= 0 ? 60 : 32 },
      tooltip: {
        trigger: "axis",
        ...(tzDateFormatter
          ? {
              formatter: (
                params: Array<{
                  marker: string;
                  seriesName: string;
                  value: [number | null, number];
                }>,
              ) => {
                if (!Array.isArray(params) || params.length === 0) return "";
                const time = params[0]?.value[0];
                if (time == null) return "";
                const timeStr = tzDateFormatter(time);
                const lines = params.map((p) => `${p.marker}${p.seriesName}: ${p.value[1]}`);
                return `${timeStr}<br/>${lines.join("<br/>")}`;
              },
            }
          : {}),
      },
      legend: {
        show: series.length > 1,
        bottom: 0,
        type: "scroll",
      },
      xAxis: {
        type: dateIdx >= 0 ? "time" : "value",
        ...(tzDateFormatter ? { axisLabel: { formatter: tzDateFormatter } } : {}),
      },
      yAxis: {
        type: "value",
        axisLabel: {
          ...(format ? { formatter: (v: number) => formatValue(v, format) } : {}),
        },
      },
      dataZoom: dateIdx >= 0 ? [{ type: "inside", start: 0, end: 100 }] : undefined,
      series,
    };
  }, [data, theme, smooth, showArea, stacked, format, timeZone]);

  return (
    <EChart
      option={option}
      theme={theme}
      _instance={instanceRef}
      sx={{ width: "100%", height: "100%", minHeight: 120 }}
    />
  );
}
