import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import SearchIcon from "@mui/icons-material/Search";

import type { EsqlResponse } from "../../types";
import type { TracesViewMode } from "../../store/useTracesStore";
import ContentSkeleton from "../ContentSkeleton";
import EmptyState from "../EmptyState";
import TraceScatterChart from "../visualizations/TraceScatterChart";
import TraceServiceMap from "../visualizations/TraceServiceMap";
import DriftRadarMap from "../visualizations/DriftRadarMap";

import { SpanTreeView } from "./span-tree-plugin";
import type { Span } from "./traceUtils";
import type { TraceFilters } from "./traceQueryBuilder";

const VIEW_MODE_LABELS: Record<TracesViewMode, string> = {
  list: "List",
  timeseries: "Time Series",
  scatter: "Scatter",
  serviceMap: "Service Map",
  driftRadar: "Drift Radar",
};

interface TraceRow {
  traceId: string;
  spanId: string;
  serviceName: string;
  name: string;
  durationUs: number;
  status: string;
  timestamp: string;
}

interface TraceResultsViewProps {
  viewMode: TracesViewMode;
  onViewModeChange: (mode: TracesViewMode) => void;
  searchResult: EsqlResponse | null;
  searchLoading: boolean;
  traceRows: TraceRow[];
  selectedTraceId: string | null;
  onSelectTrace: (traceId: string, spanId?: string, timestamp?: string) => void;
  rawQuery: string | null;
  detailLoading: boolean;
  selectedTraceSpans: Span[];
  onServiceMapNodeClick: (serviceName: string) => void;
  driftRadarLoading: boolean;
  driftRadarBaselineLoading: boolean;
  driftRadarSpans: Span[];
  driftRadarBaselineSpans: Span[] | null;
  driftRadarBaselineEnabled: boolean;
  onDriftRadarBaselineChange: (enabled: boolean) => void;
  filters: TraceFilters;
  onSearch?: () => void;
  searchSpans: Span[];
  searchSpansLoading: boolean;
  spanInsightSlotIds?: Record<string, string>;
  groupInsightSlotIds?: Record<string, string>;
  selectedSpanId?: string | null;
  onSelectSpan?: (spanId: string) => void;
  onOpenInQueryLab?: () => void;
}

export default function TraceResultsView({
  viewMode,
  onViewModeChange,
  searchResult,
  searchLoading,
  traceRows,
  selectedTraceId,
  onSelectTrace,
  rawQuery,
  onServiceMapNodeClick,
  driftRadarLoading,
  driftRadarBaselineLoading,
  driftRadarSpans,
  driftRadarBaselineSpans,
  driftRadarBaselineEnabled,
  onDriftRadarBaselineChange,
  filters,
  onSearch,
  searchSpans,
  searchSpansLoading,
  spanInsightSlotIds,
  groupInsightSlotIds,
  selectedSpanId,
  onSelectSpan,
  onOpenInQueryLab,
}: TraceResultsViewProps) {
  // Coerce legacy "timeseries" view mode (no longer supported) to "list"
  const effectiveViewMode = viewMode === "timeseries" ? "list" : viewMode;
  return (
    <Box
      sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0, overflow: "hidden" }}
    >
      {/* View switcher */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center", mb: 1 }}>
        {searchResult && traceRows.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            {traceRows.length} {traceRows.length === 1 ? "trace" : "traces"} found
          </Typography>
        )}
        {(["list", "scatter", "serviceMap", "driftRadar"] as TracesViewMode[]).map((mode) => (
          <Chip
            key={mode}
            label={VIEW_MODE_LABELS[mode]}
            size="small"
            variant={viewMode === mode ? "filled" : "outlined"}
            color={viewMode === mode ? "primary" : "default"}
            onClick={() => onViewModeChange(mode)}
          />
        ))}
        {effectiveViewMode === "driftRadar" && filters.timeFrom && rawQuery == null && (
          <Tooltip title="Compare with the previous time window of equal length to highlight new, regressed, or improved edges.">
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={driftRadarBaselineEnabled}
                  onChange={(e) => onDriftRadarBaselineChange(e.target.checked)}
                />
              }
              label={<Typography variant="caption">Compare with previous window</Typography>}
              sx={{ ml: 0.5 }}
            />
          </Tooltip>
        )}
      </Box>

      {/* Results view */}
      <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {!searchResult && !searchLoading && effectiveViewMode !== "driftRadar" && (
          <EmptyState
            icon={<SearchIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
            heading="Search for traces"
            description="Write an ES|QL query above and run Search to find traces."
            addDataHref="/add-data"
            action={
              onSearch ? (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SearchIcon />}
                  onClick={onSearch}
                >
                  Search Traces
                </Button>
              ) : undefined
            }
          />
        )}
        {searchLoading && !searchResult && effectiveViewMode !== "driftRadar" && (
          <Box sx={{ p: 2 }}>
            <ContentSkeleton variant={effectiveViewMode === "list" ? "table" : "chart"} />
          </Box>
        )}

        {/* List mode: single hierarchical traces + spans view */}
        {searchResult && effectiveViewMode === "list" && searchSpansLoading && (
          <Box sx={{ p: 2 }}>
            <ContentSkeleton variant="table" />
          </Box>
        )}
        {searchResult &&
          effectiveViewMode === "list" &&
          !searchSpansLoading &&
          searchSpans.length === 0 && (
            <EmptyState
              icon={<SearchIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
              heading="No traces matched the current query."
              description="Adjust your query or widen the time range."
            />
          )}
        {searchResult &&
          effectiveViewMode === "list" &&
          !searchSpansLoading &&
          searchSpans.length > 0 && (
            <SpanTreeView
              spans={searchSpans}
              showToolbar={false}
              spanInsightSlotIds={spanInsightSlotIds}
              groupInsightSlotIds={groupInsightSlotIds}
              selectedTraceId={selectedTraceId}
              selectedSpanId={selectedSpanId}
              onSelectTrace={onSelectTrace}
              onSelectSpan={onSelectSpan}
              onOpenInQueryLab={onOpenInQueryLab}
              loading={false}
            />
          )}

        {searchResult && effectiveViewMode === "scatter" && (
          <TraceScatterChart
            data={traceRows.map((r) => ({
              timestamp: r.timestamp,
              durationUs: r.durationUs,
              serviceName: r.serviceName,
              traceId: r.traceId,
              spanId: r.spanId,
            }))}
            onPointClick={(point) => {
              onSelectTrace(point.traceId, point.spanId, point.timestamp);
              if (point.spanId) onSelectSpan?.(point.spanId);
            }}
          />
        )}
        {searchResult && effectiveViewMode === "serviceMap" && (
          <Box sx={{ height: "100%" }}>
            {searchSpansLoading ? (
              <Box sx={{ p: 2 }}>
                <ContentSkeleton variant="chart" />
              </Box>
            ) : searchSpans.length === 0 ? (
              <EmptyState
                icon={<AccountTreeIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
                heading="No traces matched the current query."
                description="Adjust your query or widen the time range."
              />
            ) : (
              <TraceServiceMap spans={searchSpans} onNodeClick={onServiceMapNodeClick} />
            )}
          </Box>
        )}
        {effectiveViewMode === "driftRadar" &&
          (rawQuery ? (
            <EmptyState
              icon={<AccountTreeIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
              heading="Drift Radar is not available for custom ES|QL queries."
              description="Use the default query (no manual edits) to scope the window for Drift Radar."
            />
          ) : driftRadarLoading ||
            (driftRadarBaselineEnabled && driftRadarBaselineLoading) ||
            (searchLoading && !searchResult) ? (
            <Box sx={{ p: 2 }}>
              <ContentSkeleton variant="chart" />
            </Box>
          ) : driftRadarSpans.length > 0 ? (
            <Box sx={{ height: "100%" }}>
              <DriftRadarMap
                currentSpans={driftRadarSpans}
                baselineSpans={
                  driftRadarBaselineEnabled ? (driftRadarBaselineSpans ?? undefined) : undefined
                }
                onNodeClick={onServiceMapNodeClick}
              />
            </Box>
          ) : searchResult !== null ? (
            <EmptyState
              heading="No service dependencies found"
              description="The current search returned no cross-service traces for the Drift Radar map."
            />
          ) : (
            <EmptyState
              heading="Search for traces to load the Drift Radar service map."
              description="Run a trace search to compare current and baseline service topology."
            />
          ))}
      </Paper>
    </Box>
  );
}
