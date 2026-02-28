import { useMemo, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import type { Span } from "../traces/traceUtils";
import { buildServiceMapData } from "../traces/traceUtils";

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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <Typography variant="body2" color="text.secondary">
          No cross-service dependencies found for this trace
        </Typography>
      </Box>
    );
  }

  return <EChartWrapper option={option} onClick={handleClick} />;
}
