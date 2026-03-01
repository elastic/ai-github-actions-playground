import { useMemo } from "react";
import { formatValue } from "@perses-dev/core";

import type { EsqlResponse, BarChartOptions } from "../../types";
import { toBarChartData } from "../../services/perses/dataTransformers";

import { useEChartTheme } from "./useEChartTheme";
import EChartWrapper from "./EChartWrapper";

interface Props {
  data: EsqlResponse;
  options?: BarChartOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
}

export default function BarChart({ data, options, onExportReady }: Props) {
  const theme = useEChartTheme();
  const stacked = options?.stacked === true;
  const horizontal = options?.horizontal === true;
  const format = options?.format;

  const option = useMemo(() => {
    const transformed = toBarChartData(data);
    const seriesData = transformed.series;
    const categories = transformed.categories;
    const textColor = theme.textStyle?.color ?? "#9CA3AF";

    if (seriesData.length === 0) {
      return {
        ...theme,
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
        color: theme.color.length ? theme.color[i % theme.color.length] : "#0077CC",
        borderRadius: stacked ? undefined : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
      },
    }));

    const categoryAxis = {
      type: "category" as const,
      data: categories,
      axisLabel: {
        rotate: !horizontal && categories.length > 10 ? 45 : 0,
        overflow: "truncate" as const,
        width: 80,
      },
    };

    const valueAxis = {
      ...theme.yAxis,
      type: "value" as const,
      axisLabel: {
        ...theme.yAxis.axisLabel,
        ...axisLabelFormatter,
      },
    };

    return {
      ...theme,
      grid: { left: 48, right: 16, top: 32, bottom: 40 },
      tooltip: {
        ...theme.tooltip,
        trigger: "axis",
      },
      legend: {
        ...theme.legend,
        show: series.length > 1,
        bottom: 0,
        type: "scroll" as const,
      },
      xAxis: horizontal ? { ...valueAxis } : { ...theme.xAxis, ...categoryAxis },
      yAxis: horizontal ? { ...theme.yAxis, ...categoryAxis } : valueAxis,
      series,
    };
  }, [data, theme, stacked, horizontal, format]);

  return <EChartWrapper option={option} onExportReady={onExportReady} />;
}
