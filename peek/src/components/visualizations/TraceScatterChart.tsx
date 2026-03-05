import { useMemo, useCallback, useRef, useEffect } from "react";
import { EChart } from "@perses-dev/components";

import { getServiceColor, buildServiceColorMap } from "../traces/traceColors";
import { formatSpanDuration } from "../traces/traceUtils";
import { formatTimestamp, formatChartAxisDate } from "../../utils/formatDate";

import { useEChartTheme } from "./useEChartTheme";
import { escapeHtml } from "./htmlUtils";
import type { EChartInstance } from "./chartExport";

interface ScatterDataPoint {
  timestamp: string;
  durationUs: number;
  serviceName: string;
  traceId: string;
}

interface TraceScatterChartProps {
  data: ScatterDataPoint[];
  onPointClick?: (traceId: string) => void;
  /** Tighter grid for small containers (e.g. trace metrics) */
  compact?: boolean;
  /** Fixed time range for x-axis (ms). When set, shows full window instead of data extent. */
  timeRange?: { min: number; max: number } | null;
}

export default function TraceScatterChart({
  data,
  onPointClick,
  compact = false,
  timeRange,
}: TraceScatterChartProps) {
  const theme = useEChartTheme();
  const instanceRef = useRef<EChartInstance | undefined>(undefined);

  const option = useMemo(() => {
    if (data.length === 0) {
      return { title: { text: "No data to display", left: "center", top: "center" } };
    }

    // Group data by service name
    const byService = new Map<string, ScatterDataPoint[]>();
    for (const point of data) {
      const existing = byService.get(point.serviceName);
      if (existing) {
        existing.push(point);
      } else {
        byService.set(point.serviceName, [point]);
      }
    }

    const serviceNames = Array.from(byService.keys());
    const colorMap = buildServiceColorMap(serviceNames);

    const series = serviceNames
      .map((serviceName) => ({
        name: serviceName,
        type: "scatter",
        symbolSize: 6,
        data: byService
          .get(serviceName)!
          .filter((point) => point.durationUs > 0)
          .map((point) => ({
            value: [new Date(point.timestamp).getTime(), point.durationUs / 1000],
            traceId: point.traceId,
          })),
        itemStyle: {
          color: colorMap.get(serviceName) ?? getServiceColor(serviceName),
        },
      }))
      .filter((s) => s.data.length > 0);

    if (series.length === 0) {
      return { title: { text: "No data to display", left: "center", top: "center" } };
    }

    const grid = compact
      ? { left: 28, right: 4, top: 4, bottom: 18 }
      : { left: 60, right: 16, top: 24, bottom: 88 };
    return {
      grid,
      tooltip: {
        ...theme.tooltip,
        trigger: "item",
        formatter: (params: {
          seriesName: string;
          value: [number, number];
          data: { traceId: string };
        }) => {
          const ts = formatTimestamp(params.value[0]);
          const duration = formatSpanDuration(params.value[1] * 1000);
          return `<strong>${escapeHtml(params.seriesName)}</strong><br/>Time: ${escapeHtml(ts)}<br/>Duration: ${escapeHtml(duration)}<br/>Trace: ${escapeHtml(params.data.traceId.slice(0, 16))}…`;
        },
      },
      legend: {
        ...theme.legend,
        show: !compact && serviceNames.length > 1,
        bottom: 0,
        type: "scroll",
      },
      xAxis: {
        ...theme.xAxis,
        type: "time",
        splitNumber: compact ? 2 : undefined,
        ...(timeRange
          ? { min: timeRange.min, max: timeRange.max }
          : { min: "dataMin", max: "dataMax" }),
        axisLabel: {
          ...theme.xAxis?.axisLabel,
          ...(compact ? { fontSize: 10 } : {}),
          rotate: compact ? 0 : 45,
          formatter: (value: number) => formatChartAxisDate(value),
        },
      },
      yAxis: {
        ...theme.yAxis,
        type: "log",
        name: compact ? undefined : "Duration (ms)",
        axisLabel: {
          ...(theme.yAxis?.axisLabel ?? {}),
          ...(compact ? { fontSize: 9 } : {}),
          formatter: (v: number) => formatSpanDuration(v * 1000),
        },
      },
      dataZoom: compact
        ? [{ type: "inside", start: 0, end: 100 }]
        : [
            { type: "inside", start: 0, end: 100 },
            { type: "slider", start: 0, end: 100, bottom: 8, height: 20 },
          ],
      series,
    };
  }, [data, theme, compact, timeRange]);

  const handleClick = useCallback(
    (params: { data: unknown }) => {
      const point = params.data as { traceId?: string } | undefined;
      if (point?.traceId && onPointClick) {
        onPointClick(point.traceId);
      }
    },
    [onPointClick],
  );

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !onPointClick) return;
    instance.on("click", handleClick);
    return () => {
      instance.off("click", handleClick);
    };
  }, [onPointClick, handleClick]);

  return (
    <EChart
      option={option}
      theme={theme}
      _instance={instanceRef}
      sx={{ width: "100%", height: "100%", minHeight: 120 }}
    />
  );
}
