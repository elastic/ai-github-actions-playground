import { useMemo } from "react";
import type { EsqlResponse } from "../../types";
import { useEChartTheme } from "./useEChartTheme";
import { findDateColumnIndex, findNumericColumnIndices, getColumnValues } from "./chartUtils";
import EChartWrapper from "./EChartWrapper";

interface Props {
  data: EsqlResponse;
}

export default function TimeSeriesChart({ data }: Props) {
  const theme = useEChartTheme();

  const option = useMemo(() => {
    const dateIdx = findDateColumnIndex(data);
    const numericIdxs = findNumericColumnIndices(data);

    if (dateIdx < 0 && numericIdxs.length === 0) {
      return { title: { text: "No numeric data to display", left: "center", top: "center" } };
    }

    const xData =
      dateIdx >= 0
        ? getColumnValues(data, dateIdx).map((v) => (v ? new Date(v as string).getTime() : null))
        : data.values.map((_, i) => i);

    const series = numericIdxs.map((colIdx, i) => ({
      name: data.columns[colIdx]!.name,
      type: "line",
      data: getColumnValues(data, colIdx).map((v, j) => [xData[j], v]),
      smooth: true,
      showSymbol: data.values.length < 50,
      lineStyle: { width: 2 },
      areaStyle: numericIdxs.length === 1 ? { opacity: 0.1 } : undefined,
      itemStyle: { color: theme.color[i % theme.color.length] },
    }));

    return {
      ...theme,
      grid: { left: 48, right: 16, top: 32, bottom: dateIdx >= 0 ? 60 : 32 },
      tooltip: {
        ...theme.tooltip,
        trigger: "axis",
      },
      legend: {
        ...theme.legend,
        show: series.length > 1,
        bottom: 0,
        type: "scroll",
      },
      xAxis: {
        ...theme.xAxis,
        type: dateIdx >= 0 ? "time" : "category",
        data: dateIdx < 0 ? xData : undefined,
      },
      yAxis: {
        ...theme.yAxis,
        type: "value",
      },
      dataZoom: dateIdx >= 0 ? [{ type: "inside", start: 0, end: 100 }] : undefined,
      series,
    };
  }, [data, theme]);

  return <EChartWrapper option={option} />;
}
