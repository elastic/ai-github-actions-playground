import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";

import ContentSkeleton from "../ContentSkeleton";
import EmptyState from "../EmptyState";
import WaterfallChart from "../visualizations/WaterfallChart";

import type { Span } from "./traceUtils";

interface TraceDetailPanelProps {
  selectedTraceId: string;
  selectedTraceSpans: Span[];
  detailLoading: boolean;
  selectedSpanId: string | null;
  onSpanClick: (spanId: string) => void;
  onOpenInQueryLab: () => void;
  onClose: () => void;
}

export default function TraceDetailPanel({
  selectedTraceId,
  selectedTraceSpans,
  detailLoading,
  selectedSpanId,
  onSpanClick,
  onOpenInQueryLab,
  onClose,
}: TraceDetailPanelProps) {
  const [depthSelection, setDepthSelection] = useState<{
    traceId: string;
    maxNestedLevels: number | null;
  }>({ traceId: selectedTraceId, maxNestedLevels: 8 });
  const maxNestedLevels =
    depthSelection.traceId === selectedTraceId ? depthSelection.maxNestedLevels : 8;

  const depthSummary = useMemo(() => {
    if (selectedTraceSpans.length === 0) return null;
    const byId = new Map(selectedTraceSpans.map((span) => [span.spanId, span]));
    const memo = new Map<string, number>();

    const computeDepth = (spanId: string): number => {
      const cached = memo.get(spanId);
      if (cached != null) return cached;

      const path: string[] = [];
      const pathIndex = new Map<string, number>();
      let currentId: string | null = spanId;
      while (
        currentId != null &&
        byId.has(currentId) &&
        !memo.has(currentId) &&
        !pathIndex.has(currentId)
      ) {
        pathIndex.set(currentId, path.length);
        path.push(currentId);
        const parentId: string | null = byId.get(currentId)?.parentSpanId ?? null;
        currentId = parentId && byId.has(parentId) ? parentId : null;
      }

      let runningDepth = 0;
      let backfillIndex = path.length - 1;
      if (currentId != null && memo.has(currentId)) {
        runningDepth = (memo.get(currentId) ?? 0) + 1;
      } else if (currentId != null && pathIndex.has(currentId)) {
        const cycleStart = pathIndex.get(currentId) ?? 0;
        const cycleDepth = path.length - cycleStart - 1;
        for (let i = path.length - 1; i >= cycleStart; i -= 1) {
          const nodeId = path[i];
          if (nodeId != null) {
            memo.set(nodeId, cycleDepth);
          }
        }
        runningDepth = cycleDepth + 1;
        backfillIndex = cycleStart - 1;
      }

      for (let i = backfillIndex; i >= 0; i -= 1) {
        const nodeId = path[i];
        if (nodeId != null) {
          memo.set(nodeId, runningDepth);
        }
        runningDepth += 1;
      }

      return memo.get(spanId) ?? 0;
    };

    let maxDepth = 0;
    for (const span of selectedTraceSpans) {
      maxDepth = Math.max(maxDepth, computeDepth(span.spanId));
    }
    return maxDepth;
  }, [selectedTraceSpans]);

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          gap: 1,
          alignItems: "center",
          py: 0.5,
          px: 1.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle1">Trace: {selectedTraceId.slice(0, 16)}…</Typography>
        <Typography variant="caption" color="text.secondary">
          {selectedTraceSpans.length} spans
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Max depth: {depthSummary ?? 0}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {[4, 8].map((level) => (
          <Chip
            key={level}
            size="small"
            label={`Depth ${level}`}
            color={maxNestedLevels === level ? "primary" : "default"}
            variant={maxNestedLevels === level ? "filled" : "outlined"}
            onClick={() => setDepthSelection({ traceId: selectedTraceId, maxNestedLevels: level })}
          />
        ))}
        <Chip
          size="small"
          label="All levels"
          color={maxNestedLevels == null ? "primary" : "default"}
          variant={maxNestedLevels == null ? "filled" : "outlined"}
          onClick={() => setDepthSelection({ traceId: selectedTraceId, maxNestedLevels: null })}
        />
        <Button size="small" variant="outlined" onClick={onOpenInQueryLab}>
          Open in Query Lab
        </Button>
        <Button size="small" onClick={onClose}>
          Close
        </Button>
      </Box>
      {detailLoading ? (
        <Box sx={{ flex: 1, p: 2 }}>
          <ContentSkeleton variant="table" />
        </Box>
      ) : selectedTraceSpans.length > 0 ? (
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <WaterfallChart
            spans={selectedTraceSpans}
            onSpanClick={onSpanClick}
            selectedSpanId={selectedSpanId}
            maxDepth={maxNestedLevels}
          />
        </Box>
      ) : (
        <Box sx={{ flex: 1 }}>
          <EmptyState
            heading="No spans found for this trace"
            description="This trace may be incomplete or missing ingested span data."
          />
        </Box>
      )}
    </Paper>
  );
}
