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
  const [maxNestedLevels, setMaxNestedLevels] = useState<number | null>(8);
  const depthSummary = useMemo(() => {
    if (selectedTraceSpans.length === 0) return null;
    let maxDepth = 0;
    const byId = new Map(selectedTraceSpans.map((span) => [span.spanId, span]));
    for (const span of selectedTraceSpans) {
      let depth = 0;
      let currentParent = span.parentSpanId;
      const seen = new Set<string>([span.spanId]);
      while (currentParent && byId.has(currentParent) && !seen.has(currentParent)) {
        seen.add(currentParent);
        depth += 1;
        currentParent = byId.get(currentParent)?.parentSpanId ?? null;
      }
      if (depth > maxDepth) maxDepth = depth;
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
            onClick={() => setMaxNestedLevels(level)}
          />
        ))}
        <Chip
          size="small"
          label="All levels"
          color={maxNestedLevels == null ? "primary" : "default"}
          variant={maxNestedLevels == null ? "filled" : "outlined"}
          onClick={() => setMaxNestedLevels(null)}
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
