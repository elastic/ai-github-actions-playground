import type { ECharts } from "echarts/core";

export type EChartImageExporter = ECharts;

export function createPngExporter(instanceRef: { current: EChartImageExporter | undefined }) {
  return () => instanceRef.current?.getDataURL({ type: "png", pixelRatio: 2 }) ?? "";
}
