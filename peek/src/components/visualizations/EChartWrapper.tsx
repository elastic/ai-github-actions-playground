import { useRef, useEffect } from "react";
import * as echarts from "echarts/core";
import {
  LineChart,
  BarChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  CustomChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import Box from "@mui/material/Box";

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

interface Props {
  option: Record<string, unknown>;
  style?: React.CSSProperties;
  onExportReady?: (exportFn: (() => string) | null) => void;
  onClick?: (params: { dataIndex: number; seriesIndex?: number; data: unknown }) => void;
}

/**
 * Lightweight ECharts wrapper component.
 * Perses uses a similar pattern via @perses-dev/components EChart.
 */
export default function EChartWrapper({ option, style, onExportReady, onClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current);
    }
    chartRef.current.setOption(option, { notMerge: true });
  }, [option]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => chartRef.current?.resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onClick) return;
    const handler = (params: { dataIndex: number; seriesIndex?: number; data: unknown }) => {
      onClick(params);
    };
    chart.on("click", handler);
    return () => {
      chart.off("click", handler);
    };
  }, [onClick]);

  useEffect(() => {
    if (!onExportReady) return;
    onExportReady(() => chartRef.current?.getDataURL({ type: "png", pixelRatio: 2 }) ?? "");
    return () => onExportReady(null);
  }, [onExportReady]);

  return (
    <Box ref={containerRef} sx={{ width: "100%", height: "100%", minHeight: 120, ...style }} />
  );
}
