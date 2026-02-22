import { useMemo, useCallback } from "react";
import type { Span } from "../traces/traceUtils";
import {
  buildSpanTree,
  flattenSpanTree,
  getTraceTimeBounds,
  formatSpanDuration,
} from "../traces/traceUtils";
import { getServiceColor } from "../traces/traceColors";
import { useEChartTheme } from "./useEChartTheme";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
import EChartWrapper from "./EChartWrapper";

interface WaterfallChartProps {
  spans: Span[];
  onSpanClick?: (spanId: string) => void;
  selectedSpanId?: string | null;
}

export default function WaterfallChart({ spans, onSpanClick, selectedSpanId }: WaterfallChartProps) {
  const theme = useEChartTheme();

  const option = useMemo(() => {
    if (spans.length === 0) {
      return { title: { text: "No spans to display", left: "center", top: "center" } };
    }

    const tree = buildSpanTree(spans);
    const flatNodes = flattenSpanTree(tree);
    const { startUs } = getTraceTimeBounds(spans);

    const categories = flatNodes.map(
      (node) => `${"  ".repeat(node.depth)}${node.span.serviceName}: ${node.span.name}`,
    );

    // Base (invisible) bars for offset
    const baseData = flatNodes.map((node) => {
      const spanStartMs = new Date(node.span.timestamp).getTime();
      const spanStartUs = spanStartMs * 1000;
      const offsetMs = (spanStartUs - startUs) / 1000;
      return offsetMs;
    });

    // Duration bars
    const durationData = flatNodes.map((node) => node.span.durationUs / 1000);

    // Colors
    const itemColors = flatNodes.map((node) => {
      const isError = node.span.status === "Error" || node.span.status === "STATUS_CODE_ERROR";
      return {
        color: getServiceColor(node.span.serviceName),
        borderColor: isError ? "#BD271E" : "transparent",
        borderWidth: isError ? 2 : 0,
      };
    });

    const totalDurationMs = Math.max(
      ...flatNodes.map((node) => {
        const spanStartMs = new Date(node.span.timestamp).getTime();
        const spanStartUs = spanStartMs * 1000;
        return (spanStartUs - startUs + node.span.durationUs) / 1000;
      }),
      1,
    );

    return {
      ...theme,
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
          const idx = params[0]?.dataIndex ?? 0;
          const node = flatNodes[idx]!;
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
          end: Math.min(100, (20 / flatNodes.length) * 100),
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
  }, [spans, theme, selectedSpanId]);

  // Keep flatNodes accessible to the click handler without recalculating
  const flatNodesRef = useMemo(() => {
    if (spans.length === 0) return [];
    const tree = buildSpanTree(spans);
    return flattenSpanTree(tree);
  }, [spans]);

  const handleClick = useCallback(
    (params: { dataIndex: number }) => {
      const node = flatNodesRef[params.dataIndex];
      if (node && onSpanClick) {
        onSpanClick(node.span.spanId);
      }
    },
    [flatNodesRef, onSpanClick],
  );

  return <EChartWrapper option={option} onClick={onSpanClick ? handleClick : undefined} />;
}
