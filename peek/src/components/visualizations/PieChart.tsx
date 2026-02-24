import { useCallback, useMemo } from "react";

import type { EsqlResponse } from "../../types";

import { useEChartTheme } from "./useEChartTheme";
import { findNumericColumnIndices, findStringColumnIndices, getColumnValues } from "./chartUtils";
import EChartWrapper from "./EChartWrapper";

interface Props {
  data: EsqlResponse;
  onExportReady?: (exportFn: (() => string) | null) => void;
  onFilterIntent?: (field: string, value: string) => void;
}

export default function PieChart({ data, onExportReady, onFilterIntent }: Props) {
  const theme = useEChartTheme();

  const { option, nameColName } = useMemo(() => {
    const numericIdxs = findNumericColumnIndices(data);
    const stringIdxs = findStringColumnIndices(data);

    if (numericIdxs.length === 0) {
      return {
        option: { title: { text: "No numeric data to display", left: "center", top: "center" } },
        nameColName: null,
      };
    }

    const nameIdx = stringIdxs[0] ?? -1;
    const valueIdx = numericIdxs[0]!;
    const names =
      nameIdx >= 0
        ? getColumnValues(data, nameIdx).map(String)
        : data.values.map((_, i) => `Row ${i + 1}`);
    const values = getColumnValues(data, valueIdx) as number[];

    const pieData = names.map((name, i) => ({
      name,
      value: values[i] ?? 0,
    }));

    return {
      option: {
        ...theme,
        tooltip: {
          ...theme.tooltip,
          trigger: "item",
          formatter: "{b}: {c} ({d}%)",
        },
        legend: {
          ...theme.legend,
          type: "scroll" as const,
          orient: "vertical" as const,
          right: 8,
          top: "middle",
        },
        series: [
          {
            type: "pie" as const,
            radius: ["40%", "70%"],
            center: ["40%", "50%"],
            data: pieData,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0, 0, 0, 0.3)",
              },
            },
            label: { show: false },
          },
        ],
      },
      nameColName: nameIdx >= 0 && data.columns[nameIdx] ? data.columns[nameIdx]!.name : null,
    };
  }, [data, theme]);

  const handleClick = useCallback(
    (params: { name?: string; seriesName?: string; data: unknown }) => {
      if (!onFilterIntent || !nameColName) return;
      const name = params.name;
      if (name !== undefined && name !== "") {
        onFilterIntent(nameColName, name);
      }
    },
    [onFilterIntent, nameColName],
  );

  return (
    <EChartWrapper
      option={option}
      onExportReady={onExportReady}
      onClick={onFilterIntent ? handleClick : undefined}
    />
  );
}
