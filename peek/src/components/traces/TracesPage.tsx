import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Tooltip from "@mui/material/Tooltip";
import CancelIcon from "@mui/icons-material/Cancel";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { SQLDialect } from "@codemirror/lang-sql";
import { useShallow } from "zustand/react/shallow";

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { PAGE_MANIFEST } from "../../routes/manifest";
import { useConnectionStore } from "../../store/useConnectionStore";
import { useUIStore } from "../../store/useUIStore";
import { useQueryStore } from "../../store/useQueryStore";
import { useTracesStore } from "../../store/useTracesStore";
import type { TracesViewMode } from "../../store/useTracesStore";
import type { EsqlResponse } from "../../types";
import { makeLLMCompletionExtension } from "../llmCompletionExtension";
import { TRACE_TIME_RANGE_OPTIONS } from "../timePresets";
import WaterfallChart from "../visualizations/WaterfallChart";
import TraceScatterChart from "../visualizations/TraceScatterChart";
import TraceServiceMap from "../visualizations/TraceServiceMap";
import TimeSeriesChart from "../visualizations/TimeSeriesChart";
import DriftRadarMap from "../visualizations/DriftRadarMap";
import EmptyState from "../EmptyState";

import { getServiceColor } from "./traceColors";
import { parseSpansFromEsql, formatSpanDuration } from "./traceUtils";
import type { Span } from "./traceUtils";
import {
  buildTraceSearchQuery,
  buildTraceDetailQuery,
  buildTraceTimeseriesQuery,
  buildTraceQueryLabDraft,
  buildDriftRadarQuery,
  shiftTimeRangeBack,
  DEFAULT_FIELD_MAPPING,
} from "./traceQueryBuilder";
import type { TraceFilters } from "./traceQueryBuilder";
import SpanDetailDrawer from "./SpanDetailDrawer";

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: "1px solid var(--divider, #333)",
  position: "sticky",
  top: 0,
  background: "inherit",
};

interface CenteredEmptyStateProps {
  message: string;
  sx?: React.ComponentProps<typeof Box>["sx"];
}

function CenteredEmptyState({ message, sx }: CenteredEmptyStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        ...sx,
      }}
    >
      <Typography variant="body2" color="text.primary">
        {message}
      </Typography>
    </Box>
  );
}

export default function TracesPage() {
  const navigate = useNavigate();
  const connection = useConnectionStore((s) => s.connection);
  const themeMode = useUIStore((s) => s.themeMode);
  const setDiscoverQueryDraft = useQueryStore((s) => s.setDiscoverQueryDraft);
  const {
    filters,
    rawQuery,
    setRawQuery,
    updateFilters,
    selectedTraceId,
    setSelectedTraceId,
    setSelectedTraceSpans,
    selectedTraceSpans,
    selectedSpanId,
    setSelectedSpanId,
    drawerOpen,
    setDrawerOpen,
    viewMode,
    setViewMode,
    resetFilters,
  } = useTracesStore(
    useShallow((s) => ({
      filters: s.filters,
      rawQuery: s.rawQuery,
      setRawQuery: s.setRawQuery,
      updateFilters: s.updateFilters,
      selectedTraceId: s.selectedTraceId,
      setSelectedTraceId: s.setSelectedTraceId,
      setSelectedTraceSpans: s.setSelectedTraceSpans,
      selectedTraceSpans: s.selectedTraceSpans,
      selectedSpanId: s.selectedSpanId,
      setSelectedSpanId: s.setSelectedSpanId,
      drawerOpen: s.drawerOpen,
      setDrawerOpen: s.setDrawerOpen,
      viewMode: s.viewMode,
      setViewMode: s.setViewMode,
      resetFilters: s.resetFilters,
    })),
  );

  const [result, setResult] = useState<EsqlResponse | null>(null);
  const [timeseriesResult, setTimeseriesResult] = useState<EsqlResponse | null>(null);
  const [queryContextView, setQueryContextView] = useState<EditorView | null>(null);
  const [serviceFilter, setServiceFilter] = useState("");
  const [minDurationInput, setMinDurationInput] = useState("");
  const [maxDurationInput, setMaxDurationInput] = useState("");
  const [selectedTraceTimestamp, setSelectedTraceTimestamp] = useState<string | null>(null);
  const [selectedRootSpanId, setSelectedRootSpanId] = useState<string | null>(null);

  // Drift Radar state
  const [driftRadarSpans, setDriftRadarSpans] = useState<Span[]>([]);
  const [driftRadarBaselineSpans, setDriftRadarBaselineSpans] = useState<Span[] | null>(null);
  const [driftRadarBaselineEnabled, setDriftRadarBaselineEnabled] = useState(false);

  const generatedQuery = useMemo(() => buildTraceSearchQuery(filters), [filters]);
  const effectiveQuery = rawQuery ?? generatedQuery;

  // Clear user edits when filters change so the generated query takes effect
  useEffect(() => {
    setRawQuery(null);
  }, [filters, setRawQuery]);

  // Main search query
  const {
    runQuery: runSearchQuery,
    loading: searchLoading,
    error: searchError,
  } = useEsqlQuery({
    connection,
    queryContextView,
    onSuccess: (data) => setResult(data),
    onFailure: () => setResult(null),
  });

  // Trace detail query
  const {
    runQuery: runDetailQuery,
    loading: detailLoading,
    error: detailError,
  } = useEsqlQuery({
    connection,
    onSuccess: (data) => {
      const spans = parseSpansFromEsql(data.columns, data.values, DEFAULT_FIELD_MAPPING);
      setSelectedTraceSpans(spans);
    },
  });

  const {
    runQuery: runTimeseriesQuery,
    loading: timeseriesLoading,
    error: timeseriesError,
  } = useEsqlQuery({
    connection,
    onSuccess: (data) => setTimeseriesResult(data),
    onFailure: () => setTimeseriesResult(null),
  });

  // Drift Radar query — fetches all spans in the window for aggregated service map
  const {
    runQuery: runDriftRadarQuery,
    loading: driftRadarLoading,
    error: driftRadarError,
  } = useEsqlQuery({
    connection,
    onSuccess: (data) => {
      const spans = parseSpansFromEsql(data.columns, data.values, DEFAULT_FIELD_MAPPING);
      setDriftRadarSpans(spans);
    },
    onFailure: () => setDriftRadarSpans([]),
  });

  // Drift Radar baseline query — same span fetch for the previous equal window
  const {
    runQuery: runDriftRadarBaselineQuery,
    loading: driftRadarBaselineLoading,
    error: driftRadarBaselineError,
  } = useEsqlQuery({
    connection,
    onSuccess: (data) => {
      const spans = parseSpansFromEsql(data.columns, data.values, DEFAULT_FIELD_MAPPING);
      setDriftRadarBaselineSpans(spans);
    },
    onFailure: () => setDriftRadarBaselineSpans(null),
  });

  const runTraceQueries = useCallback(
    (query: string, updatedFilters = filters, includeTimeseries = rawQuery == null) => {
      setTimeseriesResult(null);
      runSearchQuery(query);
      if (includeTimeseries) {
        runTimeseriesQuery(buildTraceTimeseriesQuery(updatedFilters));
      }
    },
    [filters, rawQuery, runSearchQuery, runTimeseriesQuery],
  );

  const runDriftRadarQueries = useCallback(
    (updatedFilters: TraceFilters) => {
      if (viewMode !== "driftRadar" || rawQuery != null) return;

      setDriftRadarSpans([]);
      setDriftRadarBaselineSpans(null);
      runDriftRadarQuery(buildDriftRadarQuery(updatedFilters));
      if (driftRadarBaselineEnabled && updatedFilters.timeFrom) {
        const shifted = shiftTimeRangeBack(
          updatedFilters.timeFrom,
          updatedFilters.timeTo ?? "NOW()",
        );
        if (shifted) {
          runDriftRadarBaselineQuery(
            buildDriftRadarQuery({
              ...updatedFilters,
              timeFrom: shifted.timeFrom,
              timeTo: shifted.timeTo,
            }),
          );
        }
      }
    },
    [viewMode, rawQuery, driftRadarBaselineEnabled, runDriftRadarQuery, runDriftRadarBaselineQuery],
  );

  /** Apply a quick-filter update and immediately re-run queries so results stay in sync. */
  const applyFiltersAndRun = useCallback(
    (updates: Partial<TraceFilters>) => {
      updateFilters(updates);
      const updatedFilters = useTracesStore.getState().filters;
      runTraceQueries(buildTraceSearchQuery(updatedFilters), updatedFilters, true);
      runDriftRadarQueries(updatedFilters);
    },
    [updateFilters, runTraceQueries, runDriftRadarQueries],
  );

  const handleSearch = useCallback(() => {
    runTraceQueries(effectiveQuery, filters, rawQuery == null);
    runDriftRadarQueries(filters);
  }, [runTraceQueries, runDriftRadarQueries, effectiveQuery, filters, rawQuery]);

  const handleSelectTrace = useCallback(
    (traceId: string, spanId?: string, timestamp?: string) => {
      setSelectedTraceId(traceId);
      setSelectedRootSpanId(spanId ?? null);
      setSelectedTraceTimestamp(timestamp ?? null);
      runDetailQuery(buildTraceDetailQuery(traceId));
    },
    [setSelectedTraceId, runDetailQuery],
  );

  const handleOpenInDiscover = useCallback(
    (traceId: string, spanId?: string | null, timestamp?: string | null) => {
      setDiscoverQueryDraft(buildTraceQueryLabDraft({ traceId, spanId, timestamp }));
      navigate(PAGE_MANIFEST.discover.path);
    },
    [navigate, setDiscoverQueryDraft],
  );

  const clearTraceSelection = useCallback(() => {
    setSelectedTraceId(null);
    setSelectedRootSpanId(null);
    setSelectedTraceTimestamp(null);
  }, [setSelectedTraceId]);

  const handleApplyDuration = useCallback(() => {
    const minMs = minDurationInput !== "" ? Number(minDurationInput) : null;
    const maxMs = maxDurationInput !== "" ? Number(maxDurationInput) : null;
    applyFiltersAndRun({
      minDurationMs: minMs !== null && !isNaN(minMs) ? minMs : null,
      maxDurationMs: maxMs !== null && !isNaN(maxMs) ? maxMs : null,
    });
  }, [minDurationInput, maxDurationInput, applyFiltersAndRun]);

  const handleAddService = useCallback(() => {
    const trimmed = serviceFilter.trim();
    if (trimmed && !filters.services.includes(trimmed)) {
      applyFiltersAndRun({
        services: [...filters.services, trimmed],
      });
      setServiceFilter("");
    }
  }, [serviceFilter, filters.services, applyFiltersAndRun]);

  const handleRemoveService = useCallback(
    (service: string) => {
      applyFiltersAndRun({
        services: filters.services.filter((s) => s !== service),
      });
    },
    [filters.services, applyFiltersAndRun],
  );

  const handleServiceMapNodeClick = useCallback(
    (serviceName: string) => {
      const state = useTracesStore.getState();
      const services = state.filters.services.includes(serviceName)
        ? state.filters.services
        : [...state.filters.services, serviceName];
      state.updateFilters({ services });
      const updatedFilters = useTracesStore.getState().filters;
      runTraceQueries(buildTraceSearchQuery(updatedFilters), updatedFilters, true);
    },
    [runTraceQueries],
  );

  // Parse trace results for display
  const traceRows = useMemo(() => {
    if (!result) return [];
    const colIndex = new Map<string, number>();
    for (let i = 0; i < result.columns.length; i++) {
      colIndex.set(result.columns[i]!.name, i);
    }
    const get = (row: unknown[], field: string): unknown => {
      const idx = colIndex.get(field);
      return idx !== undefined ? row[idx] : null;
    };

    return result.values.map((row) => ({
      traceId: String(get(row, DEFAULT_FIELD_MAPPING.traceId) ?? ""),
      spanId: String(get(row, DEFAULT_FIELD_MAPPING.spanId) ?? ""),
      serviceName: String(get(row, DEFAULT_FIELD_MAPPING.serviceName) ?? "unknown"),
      name: String(get(row, DEFAULT_FIELD_MAPPING.spanName) ?? ""),
      durationUs: Number(get(row, DEFAULT_FIELD_MAPPING.durationUs) ?? 0),
      status: String(get(row, DEFAULT_FIELD_MAPPING.statusCode) ?? "OK"),
      timestamp: String(get(row, DEFAULT_FIELD_MAPPING.timestamp) ?? ""),
    }));
  }, [result]);

  const maxDuration = useMemo(
    () => Math.max(1, ...traceRows.map((r) => r.durationUs)),
    [traceRows],
  );

  const selectedSpan = useMemo(
    () => selectedTraceSpans.find((s) => s.spanId === selectedSpanId) ?? null,
    [selectedTraceSpans, selectedSpanId],
  );

  const queryEditorExtensions = useMemo(
    () => [
      SQLDialect.define({ slashComments: true }).language,
      Prec.highest(
        EditorState.languageData.of(() => [
          { commentTokens: { line: "//", block: { open: "/*", close: "*/" } } },
        ]),
      ),
      EditorView.lineWrapping,
      makeLLMCompletionExtension({
        prompt:
          "You are an ES|QL expert specializing in OpenTelemetry trace queries. " +
          "Complete the ES|QL query at the cursor. " +
          "If a recent query error is shown, suggest a fix. " +
          "If the user writes plain language (e.g. 'count traces by service'), " +
          "complete with the valid ES|QL implementation of their intent. " +
          "Return only the completion text.",
        esqlGuide: true,
      }),
    ],
    [],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100%", gap: 1 }}>
      {/* Query bar */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box
          sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            Trace Search
          </Typography>
          <Button size="small" variant="text" onClick={resetFilters}>
            Reset Filters
          </Button>
        </Box>

        {/* Filter pills */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
          {filters.services.map((svc) => (
            <Chip
              key={svc}
              label={`service: ${svc}`}
              size="small"
              onDelete={() => handleRemoveService(svc)}
              sx={{
                borderLeft: `3px solid ${getServiceColor(svc)}`,
              }}
            />
          ))}
          {filters.statusCodes.map((status) => (
            <Chip
              key={status}
              label={`status: ${status}`}
              size="small"
              color={status === "Error" ? "error" : "default"}
              deleteIcon={
                <CancelIcon data-testid={`trace-status-chip-delete-${status.toLowerCase()}`} />
              }
              onDelete={() =>
                applyFiltersAndRun({
                  statusCodes: filters.statusCodes.filter((s) => s !== status),
                })
              }
            />
          ))}
          {filters.minDurationMs !== null && (
            <Chip
              label={`min: ${filters.minDurationMs}ms`}
              size="small"
              onDelete={() => {
                applyFiltersAndRun({ minDurationMs: null });
                setMinDurationInput("");
              }}
            />
          )}
          {filters.maxDurationMs !== null && (
            <Chip
              label={`max: ${filters.maxDurationMs}ms`}
              size="small"
              onDelete={() => {
                applyFiltersAndRun({ maxDurationMs: null });
                setMaxDurationInput("");
              }}
            />
          )}
          {filters.tags.map((tag, i) => (
            <Chip
              key={`${tag.key}-${tag.value}-${i}`}
              label={`${tag.exclude ? "NOT " : ""}${tag.key}: ${tag.value}`}
              size="small"
              color={tag.exclude ? "warning" : "default"}
              onDelete={() =>
                applyFiltersAndRun({
                  tags: filters.tags.filter((_, idx) => idx !== i),
                })
              }
            />
          ))}
          {filters.timeFrom !== null && (
            <Chip
              label={`time: ${TRACE_TIME_RANGE_OPTIONS.find((o) => o.from === filters.timeFrom)?.label ?? "Custom range"}`}
              size="small"
              onDelete={() => applyFiltersAndRun({ timeFrom: null, timeTo: null })}
            />
          )}
        </Box>

        {/* Quick filters row */}
        <Box sx={{ display: "flex", gap: 1, mb: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Service name"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddService();
            }}
            sx={{ width: 160, "& .MuiInputBase-root": { height: 36 } }}
          />
          <Button size="small" variant="outlined" onClick={handleAddService} sx={{ height: 36 }}>
            Add Service
          </Button>
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            <TextField
              size="small"
              placeholder="Min (ms)"
              value={minDurationInput}
              onChange={(e) => setMinDurationInput(e.target.value)}
              sx={{ width: 100, "& .MuiInputBase-root": { height: 36 } }}
            />
            <Typography variant="body1" sx={{ px: 0.5 }}>
              —
            </Typography>
            <TextField
              size="small"
              placeholder="Max (ms)"
              value={maxDurationInput}
              onChange={(e) => setMaxDurationInput(e.target.value)}
              sx={{ width: 100, "& .MuiInputBase-root": { height: 36 } }}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={handleApplyDuration}
              sx={{ height: 36 }}
            >
              Apply
            </Button>
          </Box>
          <Select
            size="small"
            displayEmpty
            aria-label="Time range"
            value={filters.timeFrom ?? ""}
            onChange={(e) => {
              const selectedFrom = e.target.value === "" ? null : e.target.value;
              const opt = TRACE_TIME_RANGE_OPTIONS.find((o) => o.from === selectedFrom);
              if (opt) {
                applyFiltersAndRun({ timeFrom: opt.from, timeTo: opt.to });
              }
            }}
            sx={{ minWidth: 150, height: 36 }}
          >
            {TRACE_TIME_RANGE_OPTIONS.map((opt) => (
              <MenuItem key={opt.label} value={opt.from ?? ""}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
          <Box sx={{ display: "flex", gap: 0.5, ml: "auto", alignItems: "center" }}>
            {(["Error", "OK"] as const).map((status) => (
              <Chip
                key={status}
                label={status}
                size="small"
                variant={filters.statusCodes.includes(status) ? "filled" : "outlined"}
                color={status === "Error" ? "error" : "default"}
                sx={{ height: 36 }}
                onClick={() => {
                  if (filters.statusCodes.includes(status)) {
                    applyFiltersAndRun({
                      statusCodes: filters.statusCodes.filter((s) => s !== status),
                    });
                  } else {
                    applyFiltersAndRun({
                      statusCodes: [...filters.statusCodes, status],
                    });
                  }
                }}
              />
            ))}
          </Box>
        </Box>

        {/* ES|QL editor */}
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden", mb: 1 }}>
          <CodeMirror
            value={effectiveQuery}
            onChange={(val) => setRawQuery(val)}
            onCreateEditor={(view) => setQueryContextView(view)}
            extensions={queryEditorExtensions}
            theme={themeMode}
            height="120px"
            basicSetup={{ lineNumbers: true, foldGutter: false, indentOnInput: false }}
            aria-label="Trace search query editor"
          />
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={
              searchLoading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />
            }
            onClick={handleSearch}
            disabled={searchLoading || !effectiveQuery.trim()}
          >
            Search Traces
          </Button>
          {result && (
            <Typography variant="caption" color="text.secondary">
              {result.values.length} traces found
            </Typography>
          )}
        </Box>
      </Paper>

      {searchError && <Alert severity="error">{searchError}</Alert>}
      {detailError && <Alert severity="error">{detailError}</Alert>}
      {timeseriesError && <Alert severity="error">{timeseriesError}</Alert>}
      {driftRadarError && <Alert severity="error">{driftRadarError}</Alert>}
      {driftRadarBaselineError && <Alert severity="error">{driftRadarBaselineError}</Alert>}

      {/* Content area */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          minHeight: 0,
        }}
      >
        {/* Results panel */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {/* View switcher */}
          <Box sx={{ display: "flex", gap: 0.5, mb: 1, flexWrap: "wrap", alignItems: "center" }}>
            {(
              ["list", "timeseries", "scatter", "serviceMap", "driftRadar"] as TracesViewMode[]
            ).map((mode) => (
              <Chip
                key={mode}
                label={
                  mode === "list"
                    ? "List"
                    : mode === "timeseries"
                      ? "Time Series"
                      : mode === "scatter"
                        ? "Scatter"
                        : mode === "serviceMap"
                          ? "Service Map"
                          : "Drift Radar"
                }
                size="small"
                variant={viewMode === mode ? "filled" : "outlined"}
                color={viewMode === mode ? "primary" : "default"}
                onClick={() => setViewMode(mode)}
              />
            ))}
            {viewMode === "driftRadar" && filters.timeFrom && rawQuery == null && (
              <Tooltip title="Compare with the previous equal time window to highlight new, regressed, or improved edges">
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={driftRadarBaselineEnabled}
                      onChange={(e) => setDriftRadarBaselineEnabled(e.target.checked)}
                    />
                  }
                  label={<Typography variant="caption">Compare with previous window</Typography>}
                  sx={{ ml: 0.5 }}
                />
              </Tooltip>
            )}
          </Box>

          {/* Results view */}
          <Paper variant="outlined" sx={{ flex: 1, minHeight: 320, overflow: "auto" }}>
            {!result && !searchLoading && viewMode !== "driftRadar" && (
              <CenteredEmptyState message="Search for traces to see results" />
            )}
            {searchLoading && !result && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                }}
              >
                <CircularProgress size={32} />
              </Box>
            )}
            {result && viewMode === "list" && (
              <Box sx={{ overflow: "auto", height: "100%" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Trace ID</th>
                      <th style={thStyle}>Service</th>
                      <th style={thStyle}>Operation</th>
                      <th style={thStyle}>Duration</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traceRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{ padding: "24px 12px", textAlign: "center", color: "inherit" }}
                        >
                          <Typography variant="body2" color="text.primary">
                            No traces matched current filters. Adjust filters or widen the time
                            range.
                          </Typography>
                        </td>
                      </tr>
                    )}
                    {traceRows.map((row, idx) => (
                      <tr
                        key={`${row.traceId}-${idx}`}
                        tabIndex={0}
                        onClick={() => handleSelectTrace(row.traceId, row.spanId, row.timestamp)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelectTrace(row.traceId, row.spanId, row.timestamp);
                          }
                        }}
                        style={{
                          cursor: "pointer",
                          backgroundColor:
                            selectedTraceId === row.traceId ? "rgba(0,119,204,0.1)" : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (selectedTraceId !== row.traceId)
                            (e.currentTarget as HTMLElement).style.backgroundColor =
                              "rgba(255,255,255,0.04)";
                        }}
                        onMouseLeave={(e) => {
                          if (selectedTraceId !== row.traceId)
                            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                        }}
                      >
                        <td
                          style={{
                            padding: "6px 12px",
                            borderBottom: "1px solid rgba(128,128,128,0.2)",
                            fontFamily: "monospace",
                            fontSize: "0.75rem",
                          }}
                        >
                          {row.traceId.slice(0, 16)}…
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            borderBottom: "1px solid rgba(128,128,128,0.2)",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                bgcolor: getServiceColor(row.serviceName),
                                flexShrink: 0,
                              }}
                            />
                            {row.serviceName}
                          </Box>
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            borderBottom: "1px solid rgba(128,128,128,0.2)",
                          }}
                        >
                          {row.name}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            borderBottom: "1px solid rgba(128,128,128,0.2)",
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Box
                              sx={{
                                width: 60,
                                height: 4,
                                bgcolor: "action.hover",
                                borderRadius: 1,
                                overflow: "hidden",
                              }}
                            >
                              <Box
                                sx={{
                                  width: `${Math.max(2, (row.durationUs / maxDuration) * 100)}%`,
                                  height: "100%",
                                  bgcolor: getServiceColor(row.serviceName),
                                  borderRadius: 1,
                                }}
                              />
                            </Box>
                            <Typography variant="caption">
                              {formatSpanDuration(row.durationUs)}
                            </Typography>
                          </Box>
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            borderBottom: "1px solid rgba(128,128,128,0.2)",
                          }}
                        >
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              bgcolor:
                                row.status === "Error" || row.status === "STATUS_CODE_ERROR"
                                  ? "error.main"
                                  : "success.main",
                            }}
                          />
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            borderBottom: "1px solid rgba(128,128,128,0.2)",
                            fontSize: "0.75rem",
                          }}
                        >
                          {row.timestamp ? new Date(row.timestamp).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            )}
            {result && viewMode === "scatter" && (
              <TraceScatterChart
                data={traceRows.map((r) => ({
                  timestamp: r.timestamp,
                  durationUs: r.durationUs,
                  serviceName: r.serviceName,
                  traceId: r.traceId,
                }))}
                onPointClick={(traceId) => handleSelectTrace(traceId)}
              />
            )}
            {result &&
              viewMode === "timeseries" &&
              (rawQuery ? (
                <CenteredEmptyState message="Time series view is not available for custom queries. Use filter chips to see trends." />
              ) : timeseriesLoading ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                  }}
                >
                  <CircularProgress size={32} />
                </Box>
              ) : timeseriesResult ? (
                <Box sx={{ height: "100%" }}>
                  <TimeSeriesChart
                    data={timeseriesResult}
                    options={{ smooth: true, showArea: false, stacked: false }}
                  />
                </Box>
              ) : (
                <CenteredEmptyState message="Run search to load trace volume and latency trends." />
              ))}
            {result && viewMode === "serviceMap" && (
              <Box sx={{ height: "100%" }}>
                {!selectedTraceId ? (
                  <CenteredEmptyState message="Select a trace in List or Scatter view to see its service map" />
                ) : detailLoading ? (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                    }}
                  >
                    <CircularProgress size={32} />
                  </Box>
                ) : (
                  <TraceServiceMap
                    spans={selectedTraceSpans}
                    onNodeClick={handleServiceMapNodeClick}
                  />
                )}
              </Box>
            )}
            {viewMode === "driftRadar" &&
              (rawQuery ? (
                <CenteredEmptyState message="Drift Radar is not available for custom queries. Use filter chips to scope the window." />
              ) : driftRadarLoading || driftRadarBaselineLoading ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                  }}
                >
                  <CircularProgress size={32} />
                </Box>
              ) : driftRadarSpans.length > 0 ? (
                <Box sx={{ height: "100%" }}>
                  <DriftRadarMap
                    currentSpans={driftRadarSpans}
                    baselineSpans={
                      driftRadarBaselineEnabled ? (driftRadarBaselineSpans ?? undefined) : undefined
                    }
                    onNodeClick={handleServiceMapNodeClick}
                  />
                </Box>
              ) : result !== null ? (
                <CenteredEmptyState message="Run search to load the window service map." />
              ) : (
                <CenteredEmptyState message="Search for traces to load the Drift Radar service map." />
              ))}
          </Paper>

          {/* Trace Detail */}
          {selectedTraceId && (
            <Paper
              variant="outlined"
              sx={{
                mt: 1,
                flex: 1,
                minHeight: 360,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 0.5,
                  borderBottom: 1,
                  borderColor: "divider",
                }}
              >
                <Typography variant="subtitle2">Trace: {selectedTraceId.slice(0, 16)}…</Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedTraceSpans.length} spans
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    handleOpenInDiscover(
                      selectedTraceId,
                      selectedRootSpanId,
                      selectedTraceTimestamp,
                    )
                  }
                >
                  Open in Query Lab
                </Button>
                <Button size="small" onClick={clearTraceSelection}>
                  Close
                </Button>
              </Box>
              {detailLoading ? (
                <Box
                  sx={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}
                >
                  <CircularProgress size={24} />
                </Box>
              ) : selectedTraceSpans.length > 0 ? (
                <Box sx={{ flex: 1, overflow: "hidden" }}>
                  <WaterfallChart
                    spans={selectedTraceSpans}
                    onSpanClick={(spanId) => setSelectedSpanId(spanId)}
                    selectedSpanId={selectedSpanId}
                  />
                </Box>
              ) : (
                <Box sx={{ flex: 1 }}>
                  <EmptyState heading="No spans found for this trace" />
                </Box>
              )}
            </Paper>
          )}
        </Box>
      </Box>

      {/* Span Detail Drawer */}
      <SpanDetailDrawer
        span={selectedSpan}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onFilterBy={(key, value) => {
          useTracesStore.getState().addTagFilter(key, value, false);
          // Run search with the updated filters (not the stale closure)
          const updatedFilters = useTracesStore.getState().filters;
          runTraceQueries(buildTraceSearchQuery(updatedFilters), updatedFilters, true);
        }}
        onExclude={(key, value) => {
          useTracesStore.getState().addTagFilter(key, value, true);
          const updatedFilters = useTracesStore.getState().filters;
          runTraceQueries(buildTraceSearchQuery(updatedFilters), updatedFilters, true);
        }}
        onOpenInQueryLab={(spanContext) => {
          handleOpenInDiscover(spanContext.traceId, spanContext.spanId, spanContext.timestamp);
        }}
      />
    </Box>
  );
}
