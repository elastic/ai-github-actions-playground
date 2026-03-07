import { useCallback, useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { SpanTreeView } from "../traces/span-tree-plugin";
import type { Span } from "../traces/traceUtils";
import SpanDetailDrawer from "../traces/SpanDetailDrawer";
import { useTracesStore } from "../../store/useTracesStore";

import ServiceTracesTable from "./ServiceTracesTable";
import type { RecentTrace, TraceSortField } from "./serviceDashboardHelpers";

interface ServiceTracesPanelProps {
  traces: RecentTrace[];
  traceExplorerSpans: Span[];
  traceExplorerLoading: boolean;
  getSortLabelProps: (field: TraceSortField) => {
    active: boolean;
    direction: "asc" | "desc";
    onClick: () => void;
  };
  onViewTrace: (traceId: string) => void;
  onViewAllTraces: () => void;
}

export default function ServiceTracesPanel({
  traces,
  traceExplorerSpans,
  traceExplorerLoading,
  getSortLabelProps,
  onViewTrace,
  onViewAllTraces,
}: ServiceTracesPanelProps) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const showTraceExplorer = traceExplorerSpans.length > 0 || traceExplorerLoading;
  const selectedSpan = useMemo(
    () => traceExplorerSpans.find((span) => span.spanId === selectedSpanId) ?? null,
    [traceExplorerSpans, selectedSpanId],
  );

  const handleSelectSpan = useCallback((spanId: string) => {
    setSelectedSpanId(spanId);
    setDrawerOpen(true);
  }, []);

  const handleFilterBy = useCallback(
    (key: string, value: string) => {
      onViewAllTraces();
      useTracesStore.getState().addTagFilter(key, value, false);
      setDrawerOpen(false);
    },
    [onViewAllTraces],
  );
  const handleExclude = useCallback(
    (key: string, value: string) => {
      onViewAllTraces();
      useTracesStore.getState().addTagFilter(key, value, true);
      setDrawerOpen(false);
    },
    [onViewAllTraces],
  );

  return (
    <Paper variant="outlined" sx={{ minHeight: 120, overflow: "auto" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Trace Explorer
          </Typography>
          <Tooltip title="Interactive span tree for recent traces scoped to this service and time range.">
            <IconButton size="small" aria-label="About trace explorer">
              <InfoOutlinedIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
          <Chip
            size="small"
            variant="outlined"
            label={
              showTraceExplorer ? `${traceExplorerSpans.length} spans` : `${traces.length} traces`
            }
          />
        </Box>
        <Button size="small" variant="text" onClick={onViewAllTraces}>
          View All Traces →
        </Button>
      </Box>
      <Box sx={{ height: 360, minHeight: 240 }}>
        {showTraceExplorer ? (
          <SpanTreeView
            spans={traceExplorerSpans}
            showToolbar={false}
            loading={traceExplorerLoading}
            selectedSpanId={selectedSpanId}
            onSelectSpan={handleSelectSpan}
          />
        ) : (
          <ServiceTracesTable
            traces={traces}
            getSortLabelProps={getSortLabelProps}
            onViewTrace={onViewTrace}
          />
        )}
      </Box>
      <SpanDetailDrawer
        span={selectedSpan}
        open={drawerOpen && Boolean(selectedSpan)}
        selectedSpanId={selectedSpanId}
        traceSpans={traceExplorerSpans}
        searchSpans={traceExplorerSpans}
        onSelectSpan={handleSelectSpan}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedSpanId(null);
        }}
        onFilterBy={handleFilterBy}
        onExclude={handleExclude}
      />
    </Paper>
  );
}
