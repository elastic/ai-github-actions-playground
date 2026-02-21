import { useMemo } from "react";
import type { EsqlResponse } from "../../types";
import { useEChartTheme } from "./useEChartTheme";
import { findNumericColumnIndices, findStringColumnIndices, getColumnValues } from "./chartUtils";
import EChartWrapper from "./EChartWrapper";

interface Props {
  data: EsqlResponse;
}

export default function BarChart({ data }: Props) {
  const theme = useEChartTheme();

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

    const series = numericIdxs.map((colIdx, i) => ({
      name: data.columns[colIdx]!.name,
      type: "bar" as const,
      data: getColumnValues(data, colIdx) as number[],
      itemStyle: {
        color: theme.color[i % theme.color.length],
        borderRadius: [4, 4, 0, 0],
      },
    }));

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
      xAxis: {
        ...theme.xAxis,
        type: "category" as const,
        data: categories,
        axisLabel: {
          ...theme.xAxis.axisLabel,
          rotate: categories.length > 10 ? 45 : 0,
          overflow: "truncate" as const,
          width: 80,
        },
      },
      yAxis: { ...theme.yAxis, type: "value" as const },
      series,
    };
  }, [data, theme]);

  return <EChartWrapper option={option} />;
}
