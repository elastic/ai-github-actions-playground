import { useMemo } from "react";
import { formatValue } from "@perses-dev/core";

import type { EsqlResponse, GaugePanelOptions, ThresholdColor, ThresholdStep } from "../../types";

import { useEChartTheme } from "./useEChartTheme";
import { findNumericColumnIndices } from "./chartUtils";
import { THRESHOLD_PALETTE } from "./thresholdUtils";
import EChartWrapper from "./EChartWrapper";

interface Props {
  data: EsqlResponse;
  options?: GaugePanelOptions;
  onExportReady?: (exportFn: (() => string) | null) => void;
}

/**
 * Converts threshold steps into ECharts gauge axisLine color segments.
 * Each entry is [ratio, color] where ratio is a proportion from 0 to 1.
 */
function buildGaugeSegments(
  steps: ThresholdStep[],
  minVal: number,
  maxVal: number,
  baseColor: ThresholdColor,
): [number, string][] {
  const range = maxVal - minVal || 1;
  const sorted = [...steps].sort((a, b) => a.value - b.value);
  const segments: [number, string][] = [];
  let prevRatio = 0;
  let prevColor = THRESHOLD_PALETTE[baseColor];

  for (const step of sorted) {
    const ratio = Math.min(Math.max((step.value - minVal) / range, 0), 1);
    if (ratio > prevRatio) {
      segments.push([ratio, prevColor]);
    }
    prevRatio = ratio;
    prevColor = THRESHOLD_PALETTE[step.color];
  }

  if (prevRatio < 1) {
    segments.push([1, prevColor]);
  }

  return segments.length > 0 ? segments : [[1, THRESHOLD_PALETTE[baseColor]]];
}

export default function GaugePanel({ data, options, onExportReady }: Props) {
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
    const thresholds = options?.thresholds;

    const axisLineColor: [number, string][] =
      thresholds && thresholds.steps.length > 0
        ? buildGaugeSegments(thresholds.steps, minVal, maxVal, thresholds.baseColor ?? "success")
        : [[1, theme.color[0] ?? "#0077CC"]];

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
          axisLine: { lineStyle: { width: 14, color: axisLineColor } },
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

  return <EChartWrapper option={option} onExportReady={onExportReady} />;
}
