import { useMemo, useRef, useEffect } from "react";
import { EChart } from "@perses-dev/components";
import { formatValue } from "@perses-dev/core";
import type { ECharts } from "echarts/core";

import type { EsqlResponse, HistogramChartOptions } from "../../types";
import { CHART_COLORS } from "../../theme";

import { useEChartTheme } from "./useEChartTheme";
import { createPngExporter } from "./chartExport";
import { findNumericColumnIndices, getColumnValues } from "./chartUtils";

interface Props {
  data: EsqlResponse;
  options?: HistogramChartOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
}

export default function HistogramChart({ data, options, onExportReady }: Props) {
  const theme = useEChartTheme();
  const instanceRef = useRef<ECharts | undefined>(undefined);
  const bins = Math.min(100, Math.max(1, Math.round(options?.bins ?? 10)));
  const format = options?.format;

  useEffect(() => {
    if (!onExportReady) return;
    onExportReady(createPngExporter(instanceRef));
    return () => onExportReady(null);
  }, [onExportReady]);

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
      const current = counts[idx];
      if (current !== undefined) counts[idx] = current + 1;
    }

    const axisLabelFormatter = format ? { formatter: (v: number) => formatValue(v, format) } : {};

    return {
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
            color: theme.color?.length ? theme.color[0] : CHART_COLORS[0],
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: "90%",
        },
      ],
    };
  }, [data, theme, bins, format]);

  return (
    <EChart
      option={option}
      theme={theme}
      _instance={instanceRef}
      sx={{ width: "100%", height: "100%", minHeight: 120 }}
    />
  );
}
