import { useMemo, useCallback } from "react";

import type { Span } from "../traces/traceUtils";
import { buildServiceMapData } from "../traces/traceUtils";
import EmptyState from "../EmptyState";

import EChartWrapper from "./EChartWrapper";
import { buildServiceGraphOption } from "./serviceGraphOptions";

interface Props {
  spans: Span[];
  onNodeClick?: (serviceName: string) => void;
}

export default function TraceServiceMap({ spans, onNodeClick }: Props) {
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

  if (mapData.edges.length === 0) {
    return (
      <EmptyState
        size="small"
        heading="No cross-service dependencies"
        description="No dependencies found for this trace."
      />
    );
  }

  return <EChartWrapper option={option} onClick={handleClick} />;
}
