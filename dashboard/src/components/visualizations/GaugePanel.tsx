import { useMemo } from "react";
import { formatValue } from "@perses-dev/core";
import type { EsqlResponse, GaugePanelOptions } from "../../types";
import { useEChartTheme } from "./useEChartTheme";
import { findNumericColumnIndices } from "./chartUtils";
import EChartWrapper from "./EChartWrapper";

interface Props {
  data: EsqlResponse;
  options?: GaugePanelOptions;
}

export default function GaugePanel({ data, options }: Props) {
  const theme = useEChartTheme();

  const option = useMemo(() => {
    const numericIdxs = findNumericColumnIndices(data);
    if (numericIdxs.length === 0 || data.values.length === 0) {
      return { title: { text: "No numeric data", left: "center", top: "center" } };
    }

    const value = Number(data.values[0]![numericIdxs[0]!]) || 0;
    const name = data.columns[numericIdxs[0]!]!.name;

    const allValues = data.values.map((row) => Number(row[numericIdxs[0]!]) || 0);
    const autoMax = Math.max(...allValues, value * 1.5, 100);

    const minVal = Number.isFinite(options?.min) ? options!.min! : 0;
    const maxVal = Number.isFinite(options?.max) ? options!.max! : autoMax;
    const format = options?.format;

    return {
      ...theme,
      series: [
        {
          type: "gauge" as const,
          startAngle: 200,
          endAngle: -20,
          min: minVal,
          max: maxVal,
          pointer: { show: true, length: "60%" },
          progress: { show: true, width: 14, roundCap: true },
          axisLine: { lineStyle: { width: 14, color: [[1, theme.color[0]!]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            fontSize: 24,
            fontWeight: 600,
            offsetCenter: [0, "70%"],
            valueAnimation: true,
            color: theme.textStyle.color,
            formatter: format ? (v: number) => formatValue(v, format) : undefined,
          },
          title: {
            offsetCenter: [0, "90%"],
            fontSize: 12,
            color: theme.textStyle.color,
          },
          data: [{ value, name }],
        },
      ],
    };
  }, [data, theme, options]);

  return <EChartWrapper option={option} />;
}
