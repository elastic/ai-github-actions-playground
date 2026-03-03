import { useMemo, useRef, useEffect } from "react";
import { EChart } from "@perses-dev/components";
import type { ECharts } from "echarts/core";

import type { EsqlResponse } from "../../types";

import { useEChartTheme } from "./useEChartTheme";
import { createPngExporter } from "./chartExport";
import { findNumericColumnIndices, findStringColumnIndices, getColumnValues } from "./chartUtils";

interface Props {
  data: EsqlResponse;
  onExportReady?: (exportFn: (() => string) | null) => void;
}

export default function PieChart({ data, onExportReady }: Props) {
  const theme = useEChartTheme();
  const instanceRef = useRef<ECharts | undefined>(undefined);

  useEffect(() => {
    if (!onExportReady) return;
    onExportReady(createPngExporter(instanceRef));
    return () => onExportReady(null);
  }, [onExportReady]);

  const option = useMemo(() => {
    const numericIdxs = findNumericColumnIndices(data);
    const stringIdxs = findStringColumnIndices(data);

    if (numericIdxs.length === 0) {
      return { title: { text: "No numeric data to display", left: "center", top: "center" } };
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
              shadowColor: theme.textStyle?.color,
            },
          },
          label: { show: false },
        },
      ],
    };
  }, [data, theme]);

  return (
    <EChart
      option={option}
      theme={theme}
      _instance={instanceRef}
      sx={{ width: "100%", height: "100%", minHeight: 120 }}
    />
  );
}
