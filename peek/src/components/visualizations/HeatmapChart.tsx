import { useMemo } from "react";
import type { EsqlResponse } from "../../types";
import { useEChartTheme } from "./useEChartTheme";
import { findNumericColumnIndices, findStringColumnIndices, getColumnValues } from "./chartUtils";
import EChartWrapper from "./EChartWrapper";

interface Props {
  data: EsqlResponse;
}

export default function HeatmapChart({ data }: Props) {
  const theme = useEChartTheme();

  const option = useMemo(() => {
    const numericIdxs = findNumericColumnIndices(data);
    const stringIdxs = findStringColumnIndices(data);

    if (numericIdxs.length === 0) {
      return { title: { text: "No numeric data to display", left: "center", top: "center" } };
    }

    const valueIdx = numericIdxs[numericIdxs.length - 1]!;
    const rawValues = getColumnValues(data, valueIdx) as number[];
    const values = rawValues.filter((v) => v != null);

    if (values.length === 0) {
      return { title: { text: "No numeric data to display", left: "center", top: "center" } };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    // Use first two string/category columns as x and y axes, or fall back to indices
    const xIdx = stringIdxs[0] ?? (numericIdxs.length >= 3 ? numericIdxs[0]! : -1);
    const yIdx = stringIdxs[1] ?? (numericIdxs.length >= 3 ? numericIdxs[1]! : -1);

    const xLabels =
      xIdx >= 0
        ? [...new Set(getColumnValues(data, xIdx).map(String))]
        : data.values.map((_, i) => String(i));
    const yLabels = yIdx >= 0 ? [...new Set(getColumnValues(data, yIdx).map(String))] : ["value"];

    const heatmapData = data.values.flatMap((row, i) => {
      const value = rawValues[i];
      if (value == null) return [];
      const xVal = xIdx >= 0 ? String(row[xIdx]) : String(i);
      const yVal = yIdx >= 0 ? String(row[yIdx]) : "value";
      return [[xLabels.indexOf(xVal), yLabels.indexOf(yVal), value]];
    });

    return {
      ...theme,
      grid: { left: 80, right: 40, top: 16, bottom: 40 },
      tooltip: {
        ...theme.tooltip,
        position: "top",
      },
      xAxis: {
        type: "category" as const,
        data: xLabels,
        splitArea: { show: true },
      },
      yAxis: {
        type: "category" as const,
        data: yLabels,
        splitArea: { show: true },
      },
      visualMap: {
        min,
        max,
        calculable: true,
        orient: "horizontal" as const,
        left: "center",
        bottom: 0,
        inRange: {
          color: [
            "#313695",
            "#4575b4",
            "#74add1",
            "#abd9e9",
            "#fee090",
            "#fdae61",
            "#f46d43",
            "#d73027",
          ],
        },
      },
      series: [
        {
          type: "heatmap" as const,
          data: heatmapData,
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: "rgba(0, 0, 0, 0.5)" },
          },
        },
      ],
    };
  }, [data, theme]);

  return <EChartWrapper option={option} />;
}
