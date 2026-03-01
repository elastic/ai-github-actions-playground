import { useEffect, useMemo, useRef } from "react";
import { EChart } from "@perses-dev/components";
import type { EChartsCoreOption } from "echarts/core";

interface Props {
  option: Record<string, unknown>;
  style?: React.CSSProperties;
  onExportReady?: (exportFn: (() => string) | null) => void;
  onClick?: (params: { dataIndex: number; seriesIndex?: number; data: unknown }) => void;
}

export default function PersesEChartWrapper({ option, style, onExportReady, onClick }: Props) {
  const chartRef = useRef<{ getDataURL: (opts: { type: "png"; pixelRatio: number }) => string }>();

  const onEvents = useMemo(
    () =>
      onClick
        ? {
            click: (params: { dataIndex: number; seriesIndex: number; data: unknown }) => {
              onClick(params);
            },
          }
        : undefined,
    [onClick],
  );

  useEffect(() => {
    if (!onExportReady) return;
    onExportReady(() => chartRef.current?.getDataURL({ type: "png", pixelRatio: 2 }) ?? "");
    return () => onExportReady(null);
  }, [onExportReady]);

  return (
    <EChart
      option={option as EChartsCoreOption}
      onEvents={onEvents}
      onChartInitialized={(instance) => {
        chartRef.current = instance;
      }}
      style={{ width: "100%", height: "100%", minHeight: 120, ...style }}
    />
  );
}
