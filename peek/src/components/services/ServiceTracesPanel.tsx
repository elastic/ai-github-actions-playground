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

import ServiceTracesTable from "./ServiceTracesTable";
import type { RecentTrace, TraceSortField, SortDirection } from "./serviceDashboardHelpers";

interface ServiceTracesPanelProps {
  traces: RecentTrace[];
  traceExplorerSpans: Span[];
  traceExplorerLoading: boolean;
  sortField: TraceSortField;
  sortDirection: SortDirection;
  onSort: (field: TraceSortField) => void;
  onViewTrace: (traceId: string) => void;
  onViewAllTraces: () => void;
}

export default function ServiceTracesPanel({
  traces,
  traceExplorerSpans,
  traceExplorerLoading,
  sortField,
  sortDirection,
  onSort,
  onViewTrace,
  onViewAllTraces,
}: ServiceTracesPanelProps) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const selectedSpan = useMemo(
    () => traceExplorerSpans.find((span) => span.spanId === selectedSpanId) ?? null,
    [traceExplorerSpans, selectedSpanId],
  );

  const handleSelectSpan = useCallback((spanId: string) => {
    setSelectedSpanId(spanId);
    setDrawerOpen(true);
  }, []);

  const handleFilterBy = useCallback(() => undefined, []);
  const handleExclude = useCallback(() => undefined, []);

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
          <Chip size="small" variant="outlined" label={`${traces.length} traces`} />
        </Box>
        <Button size="small" variant="text" onClick={onViewAllTraces}>
          View All Traces →
        </Button>
      </Box>
      <Box sx={{ height: 360, minHeight: 240 }}>
        {traceExplorerSpans.length > 0 || traceExplorerLoading ? (
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
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={onSort}
            onViewTrace={onViewTrace}
          />
        )}
      </Box>
      <SpanDetailDrawer
        span={selectedSpan}
        open={drawerOpen}
        selectedSpanId={selectedSpanId}
        traceSpans={traceExplorerSpans}
        searchSpans={traceExplorerSpans}
        onSelectSpan={handleSelectSpan}
        onClose={() => setDrawerOpen(false)}
        onFilterBy={handleFilterBy}
        onExclude={handleExclude}
      />
    </Paper>
  );
}
