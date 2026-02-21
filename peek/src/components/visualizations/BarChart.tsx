import { useMemo } from "react";
import { formatValue } from "@perses-dev/core";
import type { EsqlResponse, BarChartOptions } from "../../types";
import { useEChartTheme } from "./useEChartTheme";
import { findNumericColumnIndices, findStringColumnIndices, getColumnValues } from "./chartUtils";
import EChartWrapper from "./EChartWrapper";

interface Props {
  data: EsqlResponse;
  options?: BarChartOptions;
}

export default function BarChart({ data, options }: Props) {
  const theme = useEChartTheme();
  const stacked = options?.stacked === true;
  const horizontal = options?.horizontal === true;
  const format = options?.format;

  const option = useMemo(() => {
    const numericIdxs = findNumericColumnIndices(data);
    const stringIdxs = findStringColumnIndices(data);

    if (numericIdxs.length === 0) {
      return { title: { text: "No numeric data to display", left: "center", top: "center" } };
    }

    const categoryIdx = stringIdxs[0] ?? -1;
    const categories =
      categoryIdx >= 0
        ? getColumnValues(data, categoryIdx).map(String)
        : data.values.map((_, i) => String(i));

    const axisLabelFormatter = format ? { formatter: (v: number) => formatValue(v, format) } : {};

    const series = numericIdxs.map((colIdx, i) => ({
      name: data.columns[colIdx]!.name,
      type: "bar" as const,
      data: getColumnValues(data, colIdx) as number[],
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

  return <EChartWrapper option={option} />;
}
