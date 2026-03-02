import { useMemo, useCallback, useRef, useEffect } from "react";
import { EChart } from "@perses-dev/components";
import type { ECharts } from "echarts/core";

import type { Span } from "../traces/traceUtils";
import { buildServiceMapData } from "../traces/traceUtils";
import EmptyState from "../EmptyState";

import { useEChartTheme } from "./useEChartTheme";
import { buildServiceGraphOption } from "./serviceGraphOptions";

interface Props {
  spans: Span[];
  onNodeClick?: (serviceName: string) => void;
}

export default function TraceServiceMap({ spans, onNodeClick }: Props) {
  const theme = useEChartTheme();
  const instanceRef = useRef<ECharts | undefined>(undefined);
  const mapData = useMemo(() => buildServiceMapData(spans), [spans]);

  const option = useMemo(() => buildServiceGraphOption({ mapData }), [mapData]);

  const handleClick = useCallback(
    (params: { data: unknown }) => {
      if (!onNodeClick || !params.data || typeof params.data !== "object") return;
      const data = params.data as { name?: unknown };
      if (typeof data.name === "string") {
        onNodeClick(data.name);
      }
    },
    [onNodeClick],
  );

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    instance.on("click", handleClick);
    return () => {
      instance.off("click", handleClick);
    };
  }, [handleClick]);

  if (mapData.edges.length === 0) {
    return (
      <EmptyState
        size="small"
        heading="No cross-service dependencies"
        description="No dependencies found for this trace."
      />
    );
  }

  return (
    <EChart
      option={option}
      theme={theme}
      _instance={instanceRef}
      sx={{ width: "100%", height: "100%", minHeight: 120 }}
    />
  );
}
