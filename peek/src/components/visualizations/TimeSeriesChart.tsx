import { useCallback, useMemo } from "react";
import { formatValue } from "@perses-dev/core";

import type { EsqlResponse, TimeSeriesOptions } from "../../types";

import { useEChartTheme } from "./useEChartTheme";
import {
  findDateColumnIndex,
  findNumericColumnIndices,
  findStringColumnIndices,
  getColumnValues,
  buildGroupedSeries,
} from "./chartUtils";
import EChartWrapper from "./EChartWrapper";

interface Props {
  data: EsqlResponse;
  options?: TimeSeriesOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
  onFilterIntent?: (field: string, value: string) => void;
}

export default function TimeSeriesChart({ data, options, onExportReady, onFilterIntent }: Props) {
  const theme = useEChartTheme();
  const smooth = options?.smooth !== false;
  const showArea = options?.showArea !== false;
  const stacked = options?.stacked === true;
  const format = options?.format;

  const { option, groupColName } = useMemo(() => {
    const dateIdx = findDateColumnIndex(data);
    const numericIdxs = findNumericColumnIndices(data);
    const stringIdxs = findStringColumnIndices(data);

    if (numericIdxs.length === 0) {
      return {
        option: { title: { text: "No numeric data to display", left: "center", top: "center" } },
        groupColName: null,
      };
    }

    const xData =
      dateIdx >= 0
        ? getColumnValues(data, dateIdx).map((v) => (v ? new Date(v as string).getTime() : null))
        : data.values.map((_, i) => i);

    const groupIdx = stringIdxs.length > 0 ? stringIdxs[0]! : -1;
    const grouped = buildGroupedSeries(data, numericIdxs, groupIdx);

    const series = grouped.map((s, i) => ({
      name: s.name,
      type: "line",
      data: s.rows.map((rowIdx) => [xData[rowIdx], data.values[rowIdx]![s.colIdx]]),
      smooth,
      showSymbol: data.values.length < 50,
      lineStyle: { width: 2 },
      areaStyle: showArea && (grouped.length === 1 || stacked) ? { opacity: 0.1 } : undefined,
      stack: stacked ? "total" : undefined,
      itemStyle: { color: theme.color.length ? theme.color[i % theme.color.length] : "#0077CC" },
    }));

    return {
      option: {
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
      },
      groupColName: groupIdx >= 0 && data.columns[groupIdx] ? data.columns[groupIdx]!.name : null,
    };
  }, [data, theme, smooth, showArea, stacked, format]);

  const handleClick = useCallback(
    (params: { seriesName?: string; name?: string; data: unknown }) => {
      if (!onFilterIntent || !groupColName) return;
      const seriesName = params.seriesName;
      if (seriesName !== undefined && seriesName !== "") {
        onFilterIntent(groupColName, seriesName);
      }
    },
    [onFilterIntent, groupColName],
  );

  return (
    <EChartWrapper
      option={option}
      onExportReady={onExportReady}
      onClick={onFilterIntent ? handleClick : undefined}
    />
  );
}
