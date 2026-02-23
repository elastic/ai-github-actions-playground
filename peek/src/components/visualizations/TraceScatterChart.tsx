import { useMemo, useCallback } from "react";
import * as echarts from "echarts/core";

import { getServiceColor, buildServiceColorMap } from "../traces/traceColors";
import { formatSpanDuration } from "../traces/traceUtils";

import { useEChartTheme } from "./useEChartTheme";
import EChartWrapper from "./EChartWrapper";

interface ScatterDataPoint {
  timestamp: string;
  durationUs: number;
  serviceName: string;
  traceId: string;
}

interface TraceScatterChartProps {
  data: ScatterDataPoint[];
  onPointClick?: (traceId: string) => void;
}

export default function TraceScatterChart({ data, onPointClick }: TraceScatterChartProps) {
  const theme = useEChartTheme();

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

    return {
      ...theme,
      grid: { left: 60, right: 16, top: 32, bottom: 60 },
      tooltip: {
        ...theme.tooltip,
        trigger: "item",
        formatter: (params: {
          seriesName: string;
          value: [number, number];
          data: { traceId: string };
        }) => {
          const ts = new Date(params.value[0]).toLocaleString();
          const duration = formatSpanDuration(params.value[1] * 1000);
          return `<strong>${echarts.format.encodeHTML(params.seriesName)}</strong><br/>Time: ${echarts.format.encodeHTML(ts)}<br/>Duration: ${echarts.format.encodeHTML(duration)}<br/>Trace: ${echarts.format.encodeHTML(params.data.traceId.slice(0, 16))}…`;
        },
      },
      legend: {
        ...theme.legend,
        show: serviceNames.length > 1,
        bottom: 0,
        type: "scroll",
      },
      xAxis: {
        ...theme.xAxis,
        type: "time",
      },
      yAxis: {
        ...theme.yAxis,
        type: "log",
        name: "Duration (ms)",
        axisLabel: {
          ...(theme.yAxis?.axisLabel ?? {}),
          formatter: (v: number) => formatSpanDuration(v * 1000),
        },
      },
      dataZoom: [{ type: "inside", start: 0, end: 100 }],
      series,
    };
  }, [data, theme]);

  const handleClick = useCallback(
    (params: { data: unknown }) => {
      const point = params.data as { traceId?: string } | undefined;
      if (point?.traceId && onPointClick) {
        onPointClick(point.traceId);
      }
    },
    [onPointClick],
  );

  return <EChartWrapper option={option} onClick={onPointClick ? handleClick : undefined} />;
}
