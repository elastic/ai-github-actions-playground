import { useMemo, useCallback } from "react";

import type { Span, SpanTreeNode } from "../traces/traceUtils";
import { buildSpanTree, flattenSpanTree, formatSpanDuration } from "../traces/traceUtils";
import { getServiceColor } from "../traces/traceColors";

import { useEChartTheme } from "./useEChartTheme";
import EChartWrapper from "./EChartWrapper";
import { escapeHtml } from "./htmlUtils";

interface WaterfallChartProps {
  spans: Span[];
  onSpanClick?: (spanId: string) => void;
  selectedSpanId?: string | null;
}

export default function WaterfallChart({
  spans,
  onSpanClick,
  selectedSpanId,
}: WaterfallChartProps) {
  const theme = useEChartTheme();

  // Single memoized computation of the span tree — shared by option and click handler
  const flatNodes: SpanTreeNode[] = useMemo(() => {
    if (spans.length === 0) return [];
    const tree = buildSpanTree(spans);
    return flattenSpanTree(tree);
  }, [spans]);

  const chartNodes = useMemo(
    () =>
      flatNodes.filter(
        (node) => Number.isFinite(node.span.startTimeUs) && Number.isFinite(node.span.durationUs),
      ),
    [flatNodes],
  );

  const option = useMemo(() => {
    if (flatNodes.length === 0) {
      return { title: { text: "No spans to display", left: "center", top: "center" } };
    }
    if (chartNodes.length === 0) {
      return { title: { text: "No valid span timestamps", left: "center", top: "center" } };
    }

    const startUs = Math.min(...chartNodes.map((node) => node.span.startTimeUs));

    const categories = chartNodes.map(
      (node) => `${"  ".repeat(node.depth)}${node.span.serviceName}: ${node.span.name}`,
    );

    // Base (invisible) bars for offset
    const baseData = chartNodes.map((node) => {
      const spanStartUs = node.span.startTimeUs;
      const offsetMs = (spanStartUs - startUs) / 1000;
      return offsetMs;
    });

    // Duration bars
    const durationData = chartNodes.map((node) => node.span.durationUs / 1000);

    // Colors — highlight selected span
    const itemColors = chartNodes.map((node) => {
      const isError = node.span.status === "Error" || node.span.status === "STATUS_CODE_ERROR";
      const isSelected = selectedSpanId === node.span.spanId;
      return {
        color: getServiceColor(node.span.serviceName),
        borderColor: isSelected ? "#FFD700" : isError ? "#BD271E" : "transparent",
        borderWidth: isSelected ? 2 : isError ? 2 : 0,
      };
    });

    const totalDurationMs = Math.max(
      ...chartNodes.map((node) => {
        const spanStartUs = node.span.startTimeUs;
        return (spanStartUs - startUs + node.span.durationUs) / 1000;
      }),
      1,
    );

    return {
      ...theme,
      legend: { show: false },
      grid: {
        left: Math.min(280, 60 + Math.max(...categories.map((c) => c.length)) * 5.5),
        right: 20,
        top: 10,
        bottom: 40,
      },
      tooltip: {
        ...theme.tooltip,
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const idx = params[0]?.dataIndex;
          if (idx == null || idx < 0 || idx >= chartNodes.length) return "Unknown span";
          const node = chartNodes[idx]!;
          return `<strong>${escapeHtml(node.span.serviceName)}</strong>: ${escapeHtml(node.span.name)}<br/>Duration: ${escapeHtml(formatSpanDuration(node.span.durationUs))}`;
        },
      },
      xAxis: {
        type: "value",
        max: totalDurationMs,
        axisLabel: {
          ...(theme.xAxis?.axisLabel ?? {}),
          formatter: (v: number) => formatSpanDuration(v * 1000),
        },
        splitLine: { ...(theme.xAxis?.splitLine ?? {}) },
      },
      yAxis: {
        type: "category",
        data: categories,
        inverse: true,
        axisLabel: {
          ...(theme.yAxis?.axisLabel ?? {}),
          fontSize: 11,
        },
      },
      dataZoom: [
        { type: "inside", xAxisIndex: 0 },
        {
          type: "slider",
          yAxisIndex: 0,
          right: 0,
          width: 15,
          start: 0,
          end: Math.min(100, (20 / chartNodes.length) * 100),
        },
      ],
      series: [
        {
          name: "Offset",
          type: "bar",
          stack: "waterfall",
          data: baseData,
          itemStyle: { color: "transparent" },
          emphasis: { itemStyle: { color: "transparent" } },
          barMaxWidth: 14,
        },
        {
          name: "Duration",
          type: "bar",
          stack: "waterfall",
          data: durationData.map((d, i) => ({
            value: d,
            itemStyle: itemColors[i],
          })),
          barMaxWidth: 14,
        },
      ],
    };
  }, [flatNodes, chartNodes, theme, selectedSpanId]);

  const handleClick = useCallback(
    (params: { dataIndex: number }) => {
      const node = chartNodes[params.dataIndex];
      if (node && onSpanClick) {
        onSpanClick(node.span.spanId);
      }
    },
    [chartNodes, onSpanClick],
  );

  return <EChartWrapper option={option} onClick={onSpanClick ? handleClick : undefined} />;
}
