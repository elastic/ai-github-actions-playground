import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import type { EsqlResponse } from "../../types";
import DataTable from "../visualizations/DataTable";
import EmptyState from "../EmptyState";

import {
  MESSAGE_FIELD,
  TRACE_ID_FIELD,
  type HistogramBucket,
  type LogsViewMode,
} from "./logsUtils";

interface LogsResultsViewProps {
  result: EsqlResponse | null;
  loading: boolean;
  viewMode: LogsViewMode;
  histogramBuckets: HistogramBucket[];
  patternGroups: Array<{ pattern: string; sample: string; count: number }>;
  onCellFilter: (field: string, value: string, exclude: boolean) => void;
  onTracePivot: (traceId: string) => void;
  onAnomalyDrillIn: (start: number, end: number) => void;
  onSearchTextChange: (text: string) => void;
  onViewModeChange: (mode: LogsViewMode) => void;
  onOpenExtractDialog: (source: string) => void;
}

export default function LogsResultsView({
  result,
  loading,
  viewMode,
  histogramBuckets,
  patternGroups,
  onCellFilter,
  onTracePivot,
  onAnomalyDrillIn,
  onSearchTextChange,
  onViewModeChange,
  onOpenExtractDialog,
}: LogsResultsViewProps) {
  const traceColIdx = result?.columns.findIndex((c) => c.name === TRACE_ID_FIELD) ?? -1;
  const firstTraceValue =
    traceColIdx >= 0
      ? (result?.values.find((row) => {
          const traceCandidate = row[traceColIdx];
          return traceCandidate != null && String(traceCandidate).trim() !== "";
        })?.[traceColIdx] ?? null)
      : null;

  return (
    <Paper
      variant="outlined"
      tabIndex={0}
      role="region"
      aria-label="Log results"
      sx={{ flex: 1, minWidth: 0, overflow: "auto" }}
    >
      <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">
          {result
            ? `${result.values.length.toLocaleString()} rows returned`
            : "Run a query to populate results"}{" "}
          — timeline and views share the visible ES|QL query above.
        </Typography>
        <Box
          sx={{
            display: "flex",
            gap: 0.5,
            alignItems: "end",
            minHeight: 64,
            overflowX: "auto",
            mt: 1,
          }}
        >
          {histogramBuckets.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              No histogram buckets yet.
            </Typography>
          )}
          {histogramBuckets.map((bucket) => (
            <Button
              key={bucket.start}
              size="small"
              variant={bucket.anomaly ? "contained" : "outlined"}
              color={bucket.anomaly ? "warning" : "inherit"}
              disabled={!bucket.anomaly}
              aria-label={`${bucket.anomaly ? "Drill into anomaly" : "Bucket"}: ${new Date(bucket.start).toLocaleTimeString()} – ${bucket.count.toLocaleString()} events`}
              onClick={() => onAnomalyDrillIn(bucket.start, bucket.end)}
              sx={{
                minWidth: 12,
                height: Math.max(12, Math.min(52, Math.log2(bucket.count + 1) * 8 + 12)),
                py: 0,
                px: 0.5,
              }}
              title={`${new Date(bucket.start).toLocaleTimeString()} • ${bucket.count.toLocaleString()} events${bucket.anomaly ? " • anomaly" : ""}`}
            />
          ))}
        </Box>
      </Box>

      {!result && !loading && (
        <EmptyState
          heading="No logs loaded"
          description="Run the current query to explore logs and click values to add filters."
        />
      )}

      {result && viewMode === "lines" && (
        <>
          <DataTable
            data={result}
            onCellClick={({ columnName, value }) => {
              if (columnName === TRACE_ID_FIELD) {
                const traceId = String(value ?? "").trim();
                if (!traceId) return;
                onTracePivot(traceId);
                return;
              }
              if (columnName === MESSAGE_FIELD) {
                onOpenExtractDialog(value);
                return;
              }
              onCellFilter(columnName, value, false);
            }}
          />
          {firstTraceValue != null && (
            <Box
              sx={{
                display: "flex",
                gap: 1,
                p: 1,
                borderTop: 1,
                borderColor: "divider",
              }}
            >
              <Button
                size="small"
                variant="text"
                startIcon={<OpenInNewIcon />}
                onClick={() => onTracePivot(String(firstTraceValue))}
              >
                Open first trace in Query Lab
              </Button>
            </Box>
          )}
        </>
      )}

      {result && viewMode === "chart" && (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Chart view uses the shared query and highlights anomaly buckets from the timeline.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click a timeline anomaly marker to append a `CHANGE_POINT` drill-in query.
          </Typography>
        </Box>
      )}
      {result && viewMode === "patterns" && (
        <List dense disablePadding>
          {patternGroups.slice(0, 50).map((group) => (
            <ListItem key={group.pattern} disablePadding>
              <ListItemButton
                onClick={() => {
                  const escapedSample = group.sample.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
                  onSearchTextChange(`"${escapedSample}"`);
                  onViewModeChange("lines");
                }}
              >
                <ListItemText
                  primary={
                    <Typography variant="caption" noWrap title={group.pattern}>
                      {group.pattern}
                    </Typography>
                  }
                  secondary={`${group.count.toLocaleString()} matching rows`}
                />
              </ListItemButton>
            </ListItem>
          ))}
          {patternGroups.length === 0 && (
            <Box sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">
                No message patterns available for clustering.
              </Typography>
            </Box>
          )}
        </List>
      )}
    </Paper>
  );
}
