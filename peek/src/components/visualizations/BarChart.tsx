import { useMemo, useRef, useEffect } from "react";
import { EChart } from "@perses-dev/components";
import { formatValue } from "@perses-dev/core";

import type { EsqlResponse, BarChartOptions } from "../../types";
import { toBarChartData } from "../../services/perses/dataTransformers";
import { CHART_COLORS } from "../../theme";

import { useEChartTheme } from "./useEChartTheme";
import { createPngExporter, type EChartInstance } from "./chartExport";

interface Props {
  data: EsqlResponse;
  options?: BarChartOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
}

export default function BarChart({ data, options, onExportReady }: Props) {
  const theme = useEChartTheme();
  const instanceRef = useRef<EChartInstance | undefined>(undefined);
  const stacked = options?.stacked === true;
  const horizontal = options?.horizontal === true;
  const format = options?.format;
  const compact = options?.compact === true;
  const axisLabelInterval = options?.axisLabelInterval;

  useEffect(() => {
    if (!onExportReady) return;
    onExportReady(createPngExporter(instanceRef));
    return () => onExportReady(null);
  }, [onExportReady]);

  const option = useMemo(() => {
    const transformed = toBarChartData(data);
    const seriesData = transformed.series;
    const categories = transformed.categories;
    const textColor = theme.textStyle?.color ?? "currentColor";

    if (seriesData.length === 0) {
      return {
        graphic: {
          type: "group",
          left: "center",
          top: "middle",
          children: [
            {
              type: "circle",
              left: "center",
              top: -44,
              shape: { cx: 0, cy: 0, r: 16 },
              style: { stroke: textColor, lineWidth: 2, fill: "transparent" },
            },
            {
              type: "text",
              left: "center",
              top: -52,
              style: {
                text: "!",
                fill: textColor,
                fontSize: 18,
                fontWeight: 700,
                textAlign: "center",
              },
            },
            {
              type: "text",
              left: "center",
              top: -10,
              style: {
                text: "No numeric data to display",
                fill: textColor,
                fontSize: 16,
                fontWeight: 700,
                textAlign: "center",
              },
            },
            {
              type: "text",
              left: "center",
              top: 18,
              style: {
                text: "Run a query that returns at least one numeric column.",
                fill: textColor,
                fontSize: 12,
                textAlign: "center",
              },
            },
          ],
        },
      };
    }

    const axisLabelFormatter = format ? { formatter: (v: number) => formatValue(v, format) } : {};
    const series = seriesData.map((entry, i) => ({
      name: entry.name,
      type: "bar" as const,
      data: entry.values,
      stack: stacked ? "total" : undefined,
      itemStyle: {
        color: theme.color.length ? theme.color[i % theme.color.length] : CHART_COLORS[0],
        borderRadius: stacked ? undefined : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
      },
    }));

    const categoryAxis = {
      type: "category" as const,
      data: categories,
      axisLabel: {
        rotate: !horizontal && categories.length > 10 ? 45 : 0,
        overflow: "truncate" as const,
        width: compact ? 60 : 80,
        ...(compact ? { fontSize: 10 } : {}),
        ...(axisLabelInterval != null ? { interval: axisLabelInterval } : {}),
      },
    };

    const valueAxis = {
      ...theme.yAxis,
      type: "value" as const,
      axisLabel: {
        ...theme.yAxis.axisLabel,
        ...(compact ? { fontSize: 9 } : {}),
        ...axisLabelFormatter,
      },
    };

    const grid = compact
      ? { left: 22, right: 4, top: 4, bottom: 18 }
      : { left: 48, right: 16, top: 32, bottom: 40 };
    return {
      grid,
      tooltip: {
        ...theme.tooltip,
        trigger: "axis",
      },
      legend: {
        ...theme.legend,
        show: !compact && series.length > 1,
        bottom: 0,
        type: "scroll" as const,
      },
      xAxis: horizontal ? { ...valueAxis } : { ...theme.xAxis, ...categoryAxis },
      yAxis: horizontal ? { ...theme.yAxis, ...categoryAxis } : valueAxis,
      series,
    };
  }, [data, theme, stacked, horizontal, format, compact, axisLabelInterval]);

  return (
    <EChart
      option={option}
      theme={theme}
      _instance={instanceRef}
      sx={{ width: "100%", height: "100%", minHeight: 120 }}
    />
  );
}
