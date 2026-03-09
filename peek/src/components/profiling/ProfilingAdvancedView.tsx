import { Fragment, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import DataFetchAlert from "../DataFetchAlert";

import { INSIGHT_GUARDRAIL } from "../../hooks/insightPromptUtils";
import type { ProfilingFilters } from "../../types/pageFilters";
import type { EsqlResponse } from "../../types";
import { COMPONENT_HEIGHTS } from "../../types/tokens";
import EmptyState from "../EmptyState";
import LoadingButton from "../LoadingButton";
import PageInsightBanner from "../PageInsightBanner";
import DateRangePicker from "../DateRangePicker";
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";
import ProfilingFlamegraph from "../visualizations/ProfilingFlamegraph";
import ProfilingFlamescope from "../visualizations/ProfilingFlamescope";
import TimeSeriesChart from "../visualizations/TimeSeriesChart";

import { buildTopFunctionsRequest } from "./profilingQueryBuilder";
import type { FlamegraphNode, SymbolizedStacktrace, TopFunctionRow } from "./profilingUtils";
import { isMissingProfilingIndex } from "./profilingUtils";

const MODE_LABELS = {
  topFunctions: "Top Functions",
  stacktraces: "Stacktraces",
  timeline: "Timeline",
  flamegraph: "Flamegraph",
  flamescope: "Flamescope",
} as const;

type ProfilingMode = keyof typeof MODE_LABELS;

interface ProfilingAdvancedViewProps {
  onNavigateGuided: () => void;
  onResetFilters: () => void;
  onOpenInQueryLab: () => void;
  onRun: () => Promise<void>;
  viewMode: ProfilingMode;
  onViewModeChange: (mode: ProfilingMode) => void;
  filters: ProfilingFilters;
  onUpdateFilters: (filters: Partial<ProfilingFilters>) => void;
  effectiveQuery: string;
  onRawQueryChange: (query: string) => void;
  loading: boolean;
  error: string | null;
  hasRunByMode: Record<ProfilingMode, boolean>;
  topFunctionsRows: TopFunctionRow[];
  timelineResult: EsqlResponse | null;
  stacktraces: SymbolizedStacktrace[];
  expandedStacktraceIds: Set<string>;
  onToggleExpandedStacktraceId: (id: string) => void;
  flamegraphTree: FlamegraphNode;
  onFrameClick: (frameName: string) => void;
  onFlamescopeWindowChange: (window: { from: string; to: string } | null) => void;
}

export default function ProfilingAdvancedView({
  onNavigateGuided,
  onResetFilters,
  onOpenInQueryLab,
  onRun,
  viewMode,
  onViewModeChange,
  filters,
  onUpdateFilters,
  effectiveQuery,
  onRawQueryChange,
  loading,
  error,
  hasRunByMode,
  topFunctionsRows,
  timelineResult,
  stacktraces,
  expandedStacktraceIds,
  onToggleExpandedStacktraceId,
  flamegraphTree,
  onFrameClick,
  onFlamescopeWindowChange,
}: ProfilingAdvancedViewProps) {
  const timelineHasData = (timelineResult?.values.length ?? 0) > 0;
  const hasDataForCurrentView =
    viewMode === "topFunctions"
      ? topFunctionsRows.length > 0
      : viewMode === "timeline"
        ? timelineHasData
        : stacktraces.length > 0;
  const hasRunCurrentView = hasRunByMode[viewMode];
  const showIdleEmptyState = !loading && !error && !hasRunCurrentView && !hasDataForCurrentView;
  const showNoDataEmptyState = !loading && !error && hasRunCurrentView && !hasDataForCurrentView;
  const canShowProfilingInsights = !loading && !error && hasRunCurrentView && hasDataForCurrentView;

  const timelineCountStats = useMemo(() => {
    if (!timelineResult) return null;
    const countIndex = timelineResult.columns.findIndex((column) => column.name === "count");
    if (countIndex < 0) return null;
    const counts = timelineResult.values
      .map((row) => Number(row[countIndex] ?? 0))
      .filter((value) => Number.isFinite(value));
    if (counts.length === 0) return null;
    return {
      points: counts.length,
      max: Math.max(...counts),
      min: Math.min(...counts),
      avg: counts.reduce((sum, value) => sum + value, 0) / counts.length,
    };
  }, [timelineResult]);

  const profilingInsightContext = useMemo(() => {
    if (!canShowProfilingInsights) return "";
    const topFunctions = topFunctionsRows.slice(0, 10).map((row) => ({
      name: row.functionName,
      total: row.totalCount ?? 0,
      self: row.selfCount ?? 0,
    }));
    const topStacks = stacktraces
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((row) => ({
        id: row.stacktraceId,
        count: row.count,
        service: row.serviceName,
        host: row.hostName,
      }));
    return JSON.stringify({
      page: "profiling-advanced",
      viewMode,
      filters,
      query: viewMode === "topFunctions" ? null : effectiveQuery,
      datasets: {
        topFunctions,
        timeline: timelineCountStats,
        stacktraces: topStacks,
        flamegraphNodeCount: flamegraphTree.children.length,
      },
    });
  }, [
    canShowProfilingInsights,
    effectiveQuery,
    filters,
    flamegraphTree.children.length,
    stacktraces,
    timelineCountStats,
    topFunctionsRows,
    viewMode,
  ]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Profiling Advanced
          </Typography>
          <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
            <Button
              size="small"
              variant="text"
              onClick={onNavigateGuided}
              sx={{ height: COMPONENT_HEIGHTS.input }}
            >
              ← Guided flow
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={onResetFilters}
              sx={{ height: COMPONENT_HEIGHTS.input }}
            >
              Reset Filters
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={onOpenInQueryLab}
              disabled={viewMode === "topFunctions" || !hasRunCurrentView}
              sx={{ height: COMPONENT_HEIGHTS.input }}
            >
              Open in Query Lab
            </Button>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mb: 1 }}>
          {(Object.keys(MODE_LABELS) as ProfilingMode[]).map((mode) => (
            <Chip
              key={mode}
              label={MODE_LABELS[mode]}
              size="small"
              variant={viewMode === mode ? "filled" : "outlined"}
              color={viewMode === mode ? "primary" : "default"}
              onClick={() => onViewModeChange(mode)}
              sx={{ height: COMPONENT_HEIGHTS.input }}
            />
          ))}
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1 }}>
          <TextField
            size="small"
            label="Executable"
            value={filters.executableName ?? ""}
            onChange={(event) => onUpdateFilters({ executableName: event.target.value || null })}
          />
          <TextField
            size="small"
            label="Thread"
            value={filters.threadName ?? ""}
            onChange={(event) => onUpdateFilters({ threadName: event.target.value || null })}
          />
          <TextField
            size="small"
            label="Service"
            value={filters.serviceName ?? ""}
            onChange={(event) => onUpdateFilters({ serviceName: event.target.value || null })}
          />
          <TextField
            size="small"
            label="Host"
            value={filters.hostName ?? ""}
            onChange={(event) => onUpdateFilters({ hostName: event.target.value || null })}
          />
          <DateRangePicker
            value={toDashboardTimeRange({ from: filters.timeFrom, to: filters.timeTo })}
            onChange={(range) => {
              const traceRange = toTraceTimeRange(range);
              onUpdateFilters({ timeFrom: traceRange.from, timeTo: traceRange.to });
            }}
          />
        </Box>
        <TextField
          fullWidth
          multiline
          minRows={4}
          label={
            viewMode === "topFunctions"
              ? "Top functions request body (JSON preview)"
              : "ES|QL query preview"
          }
          value={
            viewMode === "topFunctions"
              ? JSON.stringify(buildTopFunctionsRequest(filters), null, 2)
              : effectiveQuery
          }
          onChange={(event) => {
            if (viewMode !== "topFunctions") onRawQueryChange(event.target.value);
          }}
          slotProps={{
            input: { readOnly: viewMode === "topFunctions" },
            inputLabel: { sx: { color: "text.primary" } },
          }}
        />
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
          <LoadingButton variant="contained" size="small" onClick={onRun} loading={loading}>
            Run
          </LoadingButton>
        </Box>
      </Paper>

      {!isMissingProfilingIndex(error ?? "") && <DataFetchAlert error={error} />}
      {error && isMissingProfilingIndex(error) && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 320, overflow: "auto" }}>
          <EmptyState
            heading="No profiling data available"
            description="The profiling-events data stream was not found. Enable Universal Profiling in your Elastic cluster to start collecting continuous profiling data."
          />
        </Paper>
      )}

      {!(error && isMissingProfilingIndex(error)) && (
        <>
          {canShowProfilingInsights && profilingInsightContext && (
            <PageInsightBanner
              context={profilingInsightContext}
              systemPrompt={
                "You are an advanced profiling analyst. Use the active profiling dataset to identify " +
                "one concrete hotspot or bottleneck signal and one suggested next query/action." +
                INSIGHT_GUARDRAIL
              }
              cacheKey={`profiling-advanced::${profilingInsightContext}`}
            />
          )}
          {showIdleEmptyState && (
            <Paper variant="outlined" sx={{ flex: 1, minHeight: 320, overflow: "hidden" }}>
              <Box sx={{ display: "flex", minHeight: 320 }}>
                <EmptyState
                  heading="No profiling data"
                  description="Run the selected view to load profiling data."
                  size="small"
                />
              </Box>
            </Paper>
          )}
          {showNoDataEmptyState && (
            <Paper variant="outlined" sx={{ flex: 1, minHeight: 320, overflow: "hidden" }}>
              <Box sx={{ display: "flex", minHeight: 320 }}>
                <EmptyState
                  heading="No profiling data found"
                  description="No samples matched the selected filters and time range."
                  size="small"
                />
              </Box>
            </Paper>
          )}
          {!showIdleEmptyState && !showNoDataEmptyState && !error && (
            <Paper variant="outlined" sx={{ flex: 1, minHeight: 320, overflow: "auto" }}>
              {viewMode === "topFunctions" && topFunctionsRows.length > 0 && (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Function</TableCell>
                      <TableCell align="right">Self count</TableCell>
                      <TableCell align="right">Total count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topFunctionsRows.map((row) => (
                      <TableRow
                        key={`${row.functionName}-${String(row.selfCount)}-${String(row.totalCount)}`}
                      >
                        <TableCell>{row.functionName}</TableCell>
                        <TableCell align="right">{row.selfCount ?? "—"}</TableCell>
                        <TableCell align="right">{row.totalCount ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {viewMode === "timeline" && timelineHasData && timelineResult && (
                <Box sx={{ height: 360 }}>
                  <TimeSeriesChart
                    data={timelineResult}
                    options={{ smooth: true, showArea: false }}
                  />
                </Box>
              )}
              {viewMode === "stacktraces" && stacktraces.length > 0 && (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Stacktrace ID</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell>Service</TableCell>
                      <TableCell>Host</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stacktraces.map((stacktrace) => {
                      const isExpanded = expandedStacktraceIds.has(stacktrace.stacktraceId);
                      const detailsId = `stacktrace-details-${encodeURIComponent(stacktrace.stacktraceId)}`;
                      return (
                        <Fragment key={stacktrace.stacktraceId}>
                          <TableRow
                            hover
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            aria-controls={detailsId}
                            onClick={() => onToggleExpandedStacktraceId(stacktrace.stacktraceId)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onToggleExpandedStacktraceId(stacktrace.stacktraceId);
                              }
                            }}
                            sx={{ cursor: "pointer" }}
                          >
                            <TableCell sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                              {stacktrace.stacktraceId}
                            </TableCell>
                            <TableCell align="right">{stacktrace.count}</TableCell>
                            <TableCell>{stacktrace.serviceName || "—"}</TableCell>
                            <TableCell>{stacktrace.hostName || "—"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={4} sx={{ py: 0 }}>
                              <Collapse in={isExpanded}>
                                <Box id={detailsId} sx={{ p: 1 }}>
                                  {stacktrace.frames.map((frame) => (
                                    <Typography
                                      key={`${stacktrace.stacktraceId}-${frame.frameId}`}
                                      variant="caption"
                                      sx={{ display: "block", fontFamily: "monospace" }}
                                    >
                                      {frame.functionName}{" "}
                                      {frame.fileName
                                        ? `(${frame.fileName}${frame.lineNumber ? `:${frame.lineNumber}` : ""})`
                                        : ""}
                                    </Typography>
                                  ))}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {viewMode === "flamegraph" && stacktraces.length > 0 && (
                <Box sx={{ height: 480 }}>
                  <ProfilingFlamegraph tree={flamegraphTree} onFrameClick={onFrameClick} />
                </Box>
              )}
              {viewMode === "flamescope" && stacktraces.length > 0 && (
                <ProfilingFlamescope
                  stacktraces={stacktraces}
                  onWindowChange={onFlamescopeWindowChange}
                  onFrameClick={onFrameClick}
                />
              )}
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
