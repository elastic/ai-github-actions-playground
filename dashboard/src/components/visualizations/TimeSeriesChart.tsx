import { useMemo } from "react";
import { formatValue } from "@perses-dev/core";
import type { EsqlResponse, TimeSeriesOptions } from "../../types";
import { useEChartTheme } from "./useEChartTheme";
import { findDateColumnIndex, findNumericColumnIndices, getColumnValues } from "./chartUtils";
import EChartWrapper from "./EChartWrapper";

interface Props {
  data: EsqlResponse;
  options?: TimeSeriesOptions;
}

export default function TimeSeriesChart({ data, options }: Props) {
  const theme = useEChartTheme();
  const smooth = options?.smooth !== false;
  const showArea = options?.showArea !== false;
  const stacked = options?.stacked === true;
  const format = options?.format;

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
      smooth,
      showSymbol: data.values.length < 50,
      lineStyle: { width: 2 },
      areaStyle: showArea && (numericIdxs.length === 1 || stacked) ? { opacity: 0.1 } : undefined,
      stack: stacked ? "total" : undefined,
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
        axisLabel: {
          ...theme.yAxis.axisLabel,
          ...(format ? { formatter: (v: number) => formatValue(v, format) } : {}),
        },
      },
      dataZoom: dateIdx >= 0 ? [{ type: "inside", start: 0, end: 100 }] : undefined,
      series,
    };
  }, [data, theme, smooth, showArea, stacked, format]);

  return <EChartWrapper option={option} />;
}
