import { useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import { TracingGanttChart } from "@perses-dev/tracing-gantt-chart-plugin/lib/TracingGanttChart/TracingGanttChart";

import ContentSkeleton from "../ContentSkeleton";
import EmptyState from "../EmptyState";

import type { Span } from "./traceUtils";
import { spansToOtlpTracesData } from "./otlpAdapter";

interface TraceDetailPanelProps {
  selectedTraceId: string;
  selectedTraceSpans: Span[];
  detailLoading: boolean;
  onOpenInQueryLab: () => void;
  onClose: () => void;
}

const GANTT_OPTIONS = { visual: { palette: { mode: "auto" as const } } };

export default function TraceDetailPanel({
  selectedTraceId,
  selectedTraceSpans,
  detailLoading,
  onOpenInQueryLab,
  onClose,
}: TraceDetailPanelProps) {
  const otlpTrace = useMemo(() => spansToOtlpTracesData(selectedTraceSpans), [selectedTraceSpans]);

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
        <Box sx={{ flex: 1 }} />
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
        <Box sx={{ flex: 1, overflow: "auto" }}>
          <TracingGanttChart options={GANTT_OPTIONS} trace={otlpTrace} />
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
