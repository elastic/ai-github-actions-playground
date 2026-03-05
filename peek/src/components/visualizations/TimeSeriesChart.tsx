import { useMemo, useRef, useEffect } from "react";
import { formatValue } from "@perses-dev/core";
import { EChart } from "@perses-dev/components";

import type { EsqlResponse, TimeSeriesOptions } from "../../types";
import { toTimeSeriesData } from "../../services/perses/dataTransformers";
import { CHART_COLORS } from "../../theme";

import { createPngExporter, type EChartInstance } from "./chartExport";
import { findDateColumnIndex, formatChartAxisDate } from "./chartUtils";
import { useEChartTheme } from "./useEChartTheme";

interface Props {
  data: EsqlResponse;
  options?: TimeSeriesOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
  timeZone?: string;
}

export default function TimeSeriesChart({ data, options, onExportReady, timeZone }: Props) {
  const theme = useEChartTheme();
  const instanceRef = useRef<EChartInstance | undefined>(undefined);
  const smooth = options?.smooth !== false;
  const showArea = options?.showArea !== false;
  const stacked = options?.stacked === true;
  const format = options?.format;
  const compact = options?.compact === true;
  const timeRange = options?.timeRange;

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

    const grid = compact
      ? { left: 22, right: 4, top: 4, bottom: dateIdx >= 0 ? 18 : 12 }
      : { left: 48, right: 16, top: 32, bottom: dateIdx >= 0 ? 60 : 32 };
    return {
      grid,
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
        show: !compact && series.length > 1,
        bottom: 0,
        type: "scroll",
      },
      xAxis: {
        ...theme.xAxis,
        type: dateIdx >= 0 ? "time" : "value",
        ...(timeRange && dateIdx >= 0
          ? { min: timeRange.min, max: timeRange.max, splitNumber: compact ? 2 : undefined }
          : {}),
        axisLabel: {
          ...theme.xAxis?.axisLabel,
          ...(compact ? { fontSize: 10 } : {}),
          ...(tzDateFormatter
            ? { formatter: tzDateFormatter }
            : dateIdx >= 0
              ? { formatter: (v: number) => formatChartAxisDate(v) }
              : {}),
        },
      },
      yAxis: {
        ...theme.yAxis,
        type: "value",
        splitLine: {
          ...(theme.yAxis?.splitLine ?? {}),
          lineStyle: {
            ...(theme.yAxis?.splitLine?.lineStyle ?? {}),
            opacity: 0.2,
          },
        },
        axisLabel: {
          ...(theme.yAxis?.axisLabel ?? {}),
          ...(compact ? { fontSize: 9 } : {}),
          ...(format ? { formatter: (v: number) => formatValue(v, format) } : {}),
        },
      },
      dataZoom: dateIdx >= 0 ? [{ type: "inside", start: 0, end: 100 }] : undefined,
      series,
    };
  }, [data, theme, smooth, showArea, stacked, format, timeZone, compact, timeRange]);

  return (
    <EChart
      option={option}
      theme={theme}
      _instance={instanceRef}
      sx={{ width: "100%", height: "100%", minHeight: 120 }}
    />
  );
}
