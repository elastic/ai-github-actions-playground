import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: 360,
        overflow: "hidden",
        mt: 1,
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
        <Typography variant="subtitle2">Trace: {selectedTraceId.slice(0, 16)}…</Typography>
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
        <Box sx={{ flex: 1, overflow: "hidden" }}>
          <WaterfallChart
            spans={selectedTraceSpans}
            onSpanClick={onSpanClick}
            selectedSpanId={selectedSpanId}
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
