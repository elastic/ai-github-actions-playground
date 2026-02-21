import { useMemo } from "react";
import type { EsqlResponse } from "../../types";
import { useEChartTheme } from "./useEChartTheme";
import { findNumericColumnIndices } from "./chartUtils";
import EChartWrapper from "./EChartWrapper";

interface Props {
  data: EsqlResponse;
}

export default function GaugePanel({ data }: Props) {
  const theme = useEChartTheme();

  const option = useMemo(() => {
    const numericIdxs = findNumericColumnIndices(data);
    if (numericIdxs.length === 0 || data.values.length === 0) {
      return { title: { text: "No numeric data", left: "center", top: "center" } };
    }

    const value = Number(data.values[0]![numericIdxs[0]!]) || 0;
    const name = data.columns[numericIdxs[0]!]!.name;

    const allValues = data.values.map((row) => Number(row[numericIdxs[0]!]) || 0);
    const maxVal = Math.max(...allValues, value * 1.5, 100);

    return {
      ...theme,
      series: [
        {
          type: "gauge" as const,
          startAngle: 200,
          endAngle: -20,
          min: 0,
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
  }, [data, theme]);

  return <EChartWrapper option={option} />;
}
