import { useMemo, useRef } from "react";
import { EChart } from "@perses-dev/components";
import { formatValue } from "@perses-dev/core";
import type { ECharts } from "echarts/core";

import type { EsqlResponse, ScatterChartOptions } from "../../types";
import { CHART_COLORS } from "../../theme";

import { useEChartTheme } from "./useEChartTheme";
import { findNumericColumnIndices, findStringColumnIndices, getColumnValues } from "./chartUtils";

interface Props {
  data: EsqlResponse;
  options?: ScatterChartOptions;
}

export default function ScatterChart({ data, options }: Props) {
  const theme = useEChartTheme();
  const instanceRef = useRef<ECharts | undefined>(undefined);
  const format = options?.format;

  const option = useMemo(() => {
    const numericIdxs = findNumericColumnIndices(data);
    const stringIdxs = findStringColumnIndices(data);

    if (numericIdxs.length < 2) {
      return {
        title: {
          text: "Scatter requires at least 2 numeric columns",
          left: "center",
          top: "center",
        },
      };
    }

    const xIdx = numericIdxs[0]!;
    const yIdx = numericIdxs[1]!;
    const groupIdx = stringIdxs[0] ?? -1;

    const xValues = getColumnValues(data, xIdx) as number[];
    const yValues = getColumnValues(data, yIdx) as number[];
    const groups = groupIdx >= 0 ? getColumnValues(data, groupIdx).map(String) : null;
    const uniqueGroups = groups ? [...new Set(groups)] : [data.columns[yIdx]!.name];

    const seriesMap = new Map<string, [number, number][]>();
    for (const g of uniqueGroups) seriesMap.set(g, []);

    for (let i = 0; i < data.values.length; i++) {
      const key = groups ? groups[i]! : uniqueGroups[0]!;
      const x = xValues[i];
      const y = yValues[i];
      if (x == null || y == null) continue;
      seriesMap.get(key)?.push([x, y]);
    }

    const axisLabelFormatter = format ? { formatter: (v: number) => formatValue(v, format) } : {};

    const series = [...seriesMap.entries()].map(([name, points], i) => ({
      name,
      type: "scatter" as const,
      data: points,
      itemStyle: {
        color: theme.color?.length ? theme.color[i % theme.color.length] : CHART_COLORS[0],
      },
    }));

    return {
      grid: { left: 48, right: 16, top: 32, bottom: 40 },
      tooltip: {
        ...theme.tooltip,
        trigger: "item",
      },
      legend: {
        ...theme.legend,
        show: series.length > 1,
        bottom: 0,
        type: "scroll" as const,
      },
      xAxis: {
        ...theme.xAxis,
        type: "value" as const,
        name: data.columns[xIdx]!.name,
      },
      yAxis: {
        ...theme.yAxis,
        type: "value" as const,
        name: data.columns[yIdx]!.name,
        axisLabel: {
          ...(theme.yAxis?.axisLabel ?? {}),
          ...axisLabelFormatter,
        },
      },
      series,
    };
  }, [data, theme, format]);

  return (
    <EChart
      option={option}
      theme={theme}
      _instance={instanceRef}
      sx={{ width: "100%", height: "100%", minHeight: 120 }}
    />
  );
}
