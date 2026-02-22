import { useMemo } from "react";
import { formatValue } from "@perses-dev/core";
import type { EsqlResponse, HistogramChartOptions } from "../../types";
import { useEChartTheme } from "./useEChartTheme";
import { findNumericColumnIndices, getColumnValues } from "./chartUtils";
import EChartWrapper from "./EChartWrapper";

interface Props {
  data: EsqlResponse;
  options?: HistogramChartOptions;
}

export default function HistogramChart({ data, options }: Props) {
  const theme = useEChartTheme();
  const bins = Math.min(100, Math.max(1, Math.round(options?.bins ?? 10)));
  const format = options?.format;

  const option = useMemo(() => {
    const numericIdxs = findNumericColumnIndices(data);

    if (numericIdxs.length === 0) {
      return { title: { text: "No numeric data to display", left: "center", top: "center" } };
    }

    const colIdx = numericIdxs[0]!;
    const values = (getColumnValues(data, colIdx) as number[]).filter((v) => v != null);

    if (values.length === 0) {
      return { title: { text: "No numeric data to display", left: "center", top: "center" } };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = max === min ? 1 : (max - min) / bins;

    const counts = new Array<number>(bins).fill(0);
    const labels: string[] = [];

    for (let i = 0; i < bins; i++) {
      const lo = min + i * binWidth;
      const hi = lo + binWidth;
      labels.push(`${lo.toPrecision(3)}–${hi.toPrecision(3)}`);
    }

    for (const v of values) {
      let idx = Math.floor((v - min) / binWidth);
      if (idx >= bins) idx = bins - 1;
      counts[idx]++;
    }

    const axisLabelFormatter = format ? { formatter: (v: number) => formatValue(v, format) } : {};

    return {
      ...theme,
      grid: { left: 48, right: 16, top: 32, bottom: 40 },
      tooltip: {
        ...theme.tooltip,
        trigger: "axis",
      },
      xAxis: {
        type: "category" as const,
        data: labels,
        axisLabel: {
          rotate: bins > 10 ? 45 : 0,
          overflow: "truncate" as const,
          width: 80,
        },
      },
      yAxis: {
        ...theme.yAxis,
        type: "value" as const,
        name: "Count",
        axisLabel: {
          ...(theme.yAxis?.axisLabel ?? {}),
          ...axisLabelFormatter,
        },
      },
      series: [
        {
          name: data.columns[colIdx]!.name,
          type: "bar" as const,
          data: counts,
          itemStyle: {
            color: theme.color?.length ? theme.color[0] : "#0077CC",
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: "90%",
        },
      ],
    };
  }, [data, theme, bins, format]);

  return <EChartWrapper option={option} />;
}
