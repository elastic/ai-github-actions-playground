import { useCallback, useMemo } from "react";
import { formatValue } from "@perses-dev/core";

import type { EsqlResponse, BarChartOptions } from "../../types";

import { useEChartTheme } from "./useEChartTheme";
import {
  findNumericColumnIndices,
  findStringColumnIndices,
  getColumnValues,
  buildGroupedSeries,
} from "./chartUtils";
import EChartWrapper from "./EChartWrapper";

interface Props {
  data: EsqlResponse;
  options?: BarChartOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
  onFilterIntent?: (field: string, value: string) => void;
}

export default function BarChart({ data, options, onExportReady, onFilterIntent }: Props) {
  const theme = useEChartTheme();
  const stacked = options?.stacked === true;
  const horizontal = options?.horizontal === true;
  const format = options?.format;

  const { option, categoryColName } = useMemo(() => {
    const numericIdxs = findNumericColumnIndices(data);
    const stringIdxs = findStringColumnIndices(data);

    if (numericIdxs.length === 0) {
      return {
        option: { title: { text: "No numeric data to display", left: "center", top: "center" } },
        categoryColName: null,
      };
    }

    const categoryIdx = stringIdxs[0] ?? -1;
    const groupIdx = stringIdxs.length >= 2 ? stringIdxs[1]! : -1;

    const axisLabelFormatter = format ? { formatter: (v: number) => formatValue(v, format) } : {};

    let categories: string[];
    let series;

    if (groupIdx >= 0) {
      const rawCategories = getColumnValues(data, categoryIdx).map(String);
      categories = [...new Set(rawCategories)];
      const grouped = buildGroupedSeries(data, numericIdxs, groupIdx);

      series = grouped.map((s, i) => {
        const seriesData = categories.map((cat) => {
          return s.rows.reduce((sum, rowIdx) => {
            if (rawCategories[rowIdx] !== cat) return sum;
            const value = Number(data.values[rowIdx]![s.colIdx] ?? 0);
            return Number.isFinite(value) ? sum + value : sum;
          }, 0);
        });
        return {
          name: s.name,
          type: "bar" as const,
          data: seriesData,
          stack: stacked ? "total" : undefined,
          itemStyle: {
            color: theme.color.length ? theme.color[i % theme.color.length] : "#0077CC",
            borderRadius: stacked ? undefined : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
          },
        };
      });
    } else {
      categories =
        categoryIdx >= 0
          ? getColumnValues(data, categoryIdx).map(String)
          : data.values.map((_, i) => String(i));

      series = numericIdxs.map((colIdx, i) => ({
        name: data.columns[colIdx]!.name,
        type: "bar" as const,
        data: getColumnValues(data, colIdx) as number[],
        stack: stacked ? "total" : undefined,
        itemStyle: {
          color: theme.color.length ? theme.color[i % theme.color.length] : "#0077CC",
          borderRadius: stacked ? undefined : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
        },
      }));
    }

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
      option: {
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
      },
      categoryColName:
        categoryIdx >= 0 && data.columns[categoryIdx] ? data.columns[categoryIdx]!.name : null,
    };
  }, [data, theme, stacked, horizontal, format]);

  const handleClick = useCallback(
    (params: { name?: string; seriesName?: string; data: unknown }) => {
      if (!onFilterIntent || !categoryColName) return;
      const name = params.name;
      if (name !== undefined && name !== "") {
        onFilterIntent(categoryColName, name);
      }
    },
    [onFilterIntent, categoryColName],
  );

  return (
    <EChartWrapper
      option={option}
      onExportReady={onExportReady}
      onClick={onFilterIntent ? handleClick : undefined}
    />
  );
}
