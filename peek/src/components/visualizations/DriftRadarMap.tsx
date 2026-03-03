import { useMemo, useCallback, useRef, useEffect } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import type { ECharts } from "echarts/core";

import type { Span, ServiceMapEdge } from "../traces/traceUtils";
import { buildServiceMapData } from "../traces/traceUtils";
import { STATUS_COLORS } from "../../types/tokens";
import EmptyState from "../EmptyState";
import { EChart } from "../perses/PersesEChartWrapper";

import { useEChartTheme } from "./useEChartTheme";
import { buildServiceGraphOption } from "./serviceGraphOptions";
import type { EdgeExtras } from "./serviceGraphOptions";

interface Props {
  currentSpans: Span[];
  baselineSpans?: Span[];
  onNodeClick?: (serviceName: string) => void;
}

type EdgeStatus = "new" | "regressed" | "improved" | "stable";

/** Display order for the legend chips and classification comparisons. */
const EDGE_STATUS_ORDER: EdgeStatus[] = ["new", "regressed", "improved", "stable"];

const EDGE_STATUS_COLOR: Record<EdgeStatus, string> = {
  new: "#0077CC",
  regressed: STATUS_COLORS.error,
  improved: "#00BFB3",
  stable: STATUS_COLORS.unknown,
};

function classifyEdge(current: ServiceMapEdge, baseline?: ServiceMapEdge): EdgeStatus {
  if (!baseline) return "new";

  const currentErrorRate = current.callCount > 0 ? current.errorCount / current.callCount : 0;
  const baselineErrorRate = baseline.callCount > 0 ? baseline.errorCount / baseline.callCount : 0;

  const currentAvgUs = current.callCount > 0 ? current.totalDurationUs / current.callCount : 0;
  const baselineAvgUs = baseline.callCount > 0 ? baseline.totalDurationUs / baseline.callCount : 0;

  const errorRateDiff = currentErrorRate - baselineErrorRate;
  const latencyRatio = baselineAvgUs > 0 ? (currentAvgUs - baselineAvgUs) / baselineAvgUs : 0;

  if (errorRateDiff > 0.05 || latencyRatio > 0.2) return "regressed";
  if (errorRateDiff < -0.05 || latencyRatio < -0.2) return "improved";
  return "stable";
}

export default function DriftRadarMap({ currentSpans, baselineSpans, onNodeClick }: Props) {
  const theme = useEChartTheme();
  const instanceRef = useRef<ECharts | undefined>(undefined);
  const mapData = useMemo(() => buildServiceMapData(currentSpans), [currentSpans]);
  const baselineMapData = useMemo(
    () => (baselineSpans ? buildServiceMapData(baselineSpans) : null),
    [baselineSpans],
  );

  const baselineEdgeMap = useMemo(() => {
    if (!baselineMapData) return null;
    const m = new Map<string, ServiceMapEdge>();
    for (const edge of baselineMapData.edges) {
      m.set(`${edge.source}→${edge.target}`, edge);
    }
    return m;
  }, [baselineMapData]);

  const edgeStatuses = useMemo<Map<string, EdgeStatus>>(() => {
    const result = new Map<string, EdgeStatus>();
    for (const edge of mapData.edges) {
      const key = `${edge.source}→${edge.target}`;
      if (!baselineEdgeMap) {
        result.set(key, "stable");
        continue;
      }
      const baselineEdge = baselineEdgeMap?.get(key);
      result.set(key, classifyEdge(edge, baselineEdge));
    }
    return result;
  }, [mapData.edges, baselineEdgeMap]);

  const legendStatuses = useMemo<EdgeStatus[]>(() => {
    const seen = new Set<EdgeStatus>();
    for (const status of edgeStatuses.values()) {
      seen.add(status);
    }
    return EDGE_STATUS_ORDER.filter((s) => seen.has(s));
  }, [edgeStatuses]);

  const legendLabel: Record<EdgeStatus, string> = {
    new: "New edge",
    regressed: "Regressed",
    improved: "Improved",
    stable: "Stable",
  };

  const option = useMemo(() => {
    return buildServiceGraphOption({
      mapData,
      errorColor: EDGE_STATUS_COLOR.regressed,
      edgeExtras: (edge: ServiceMapEdge): EdgeExtras => {
        const key = `${edge.source}→${edge.target}`;
        const status = edgeStatuses.get(key) ?? "stable";
        return {
          tooltipSuffix: ` [${status}]`,
          color: EDGE_STATUS_COLOR[status],
          opacity: 0.85,
          data: { edgeStatus: status },
        };
      },
    });
  }, [mapData, edgeStatuses]);

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
    if (!instance || !onNodeClick || mapData.edges.length === 0) return;
    instance.on("click", handleClick);
    return () => {
      instance.off("click", handleClick);
    };
  }, [onNodeClick, handleClick, mapData.edges.length, theme]);

  if (mapData.edges.length === 0) {
    return (
      <EmptyState
        size="small"
        heading="No cross-service dependencies"
        description="No dependencies found in this time window."
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {legendStatuses.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, pt: 1, px: 1.5 }}>
          {legendStatuses.map((status) => (
            <Chip
              key={status}
              size="small"
              label={legendLabel[status]}
              sx={{
                borderLeft: `4px solid ${EDGE_STATUS_COLOR[status]}`,
                fontSize: "0.7rem",
              }}
            />
          ))}
        </Box>
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <EChart
          option={option}
          theme={theme}
          _instance={instanceRef}
          sx={{ width: "100%", height: "100%", minHeight: 120 }}
        />
      </Box>
    </Box>
  );
}
