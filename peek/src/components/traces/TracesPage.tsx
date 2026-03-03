import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Collapse from "@mui/material/Collapse";
import Button from "@mui/material/Button";
import { EditorView } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { SQLDialect } from "@codemirror/lang-sql";
import { useShallow } from "zustand/react/shallow";
import { parseAsString, useQueryState } from "nuqs";
import { useQueryClient, useQuery } from "@tanstack/react-query";

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { PAGE_MANIFEST } from "../../routes/manifest";
import { useConnectionStore } from "../../store/useConnectionStore";
import { useUIStore } from "../../store/useUIStore";
import { useQueryStore } from "../../store/useQueryStore";
import { useTracesStore } from "../../store/useTracesStore";
import { makeLLMCompletionExtension } from "../llmCompletionExtension";
import ResizableSplitPane from "../ResizableSplitPane";
import type { EsqlResponse } from "../../types";

import { parseSpansFromEsql, formatStatusLabel } from "./traceUtils";
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
import TraceSearchPanel from "./TraceSearchPanel";
import TraceDetailPanel from "./TraceDetailPanel";
import TraceResultsView from "./TraceResultsView";

/** User-facing summary for raw ES|QL / Elasticsearch parser errors. */
function summarizeError(raw: string): string {
  if (/second argument of \[.*\] must be \[.*\]/i.test(raw) || /type mismatch/i.test(raw)) {
    return "A query type mismatch occurred. Results may still be usable.";
  }
  if (/verification_exception/i.test(raw) || /Found \d+ problem/i.test(raw)) {
    return "The query encountered a validation issue.";
  }
  if (/parsing_exception/i.test(raw)) {
    return "The query could not be parsed.";
  }
  return "A query error occurred.";
}

/** Renders non-blocking, collapsible error alerts for trace queries. */
function TraceErrorAlerts({ errors }: { errors: (string | null)[] }) {
  const [expanded, setExpanded] = useState(false);
  const activeErrors = [...new Set(errors.filter((e): e is string => e != null))];
  const summaries = [...new Set(activeErrors.map((error) => summarizeError(error)))];
  if (activeErrors.length === 0) return null;

  return (
    <Alert
      severity="error"
      sx={{ position: "relative", zIndex: 0, pointerEvents: "auto" }}
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide details" : "Show details"}
        </Button>
      }
    >
      <AlertTitle>Query error</AlertTitle>
      {summaries.join(" ")}
      <Collapse in={expanded}>
        <Box
          component="pre"
          sx={{
            maxHeight: 200,
            overflow: "auto",
            mt: 1,
            p: 1,
            borderRadius: 1,
            bgcolor: "action.hover",
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
            fontSize: "0.75rem",
          }}
        >
          {activeErrors.join("\n\n")}
        </Box>
      </Collapse>
    </Alert>
  );
}

export default function TracesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  // React Query cache for search and timeseries results (cached across navigation)
  const { data: searchResult = null } = useQuery<EsqlResponse | null>({
    queryKey: ["traces-search"],
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const { data: timeseriesResult = null } = useQuery<EsqlResponse | null>({
    queryKey: ["traces-timeseries"],
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setSearchResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(["traces-search"], result),
    [queryClient],
  );
  const setTimeseriesResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(["traces-timeseries"], result),
    [queryClient],
  );

  const traceSearchCollapsed = useUIStore((s) => s.traceSearchCollapsed);
  const setTraceSearchCollapsed = useUIStore((s) => s.setTraceSearchCollapsed);

  const [queryContextView, setQueryContextView] = useState<EditorView | null>(null);
  const [selectedTraceTimestamp, setSelectedTraceTimestamp] = useState<string | null>(null);
  const [selectedRootSpanId, setSelectedRootSpanId] = useState<string | null>(null);

  // Sync selectedTraceId with URL query parameter
  const [urlTraceId, setUrlTraceId] = useQueryState("traceId", parseAsString);

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

  // Cmd/Ctrl+[ toggles the search panel collapse
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "[" && !e.repeat) {
        e.preventDefault();
        setTraceSearchCollapsed(!useUIStore.getState().traceSearchCollapsed);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setTraceSearchCollapsed]);

  // Main search query
  const handleSearchSuccess = useCallback(
    (data: EsqlResponse) => setSearchResult(data),
    [setSearchResult],
  );
  const handleSearchFailure = useCallback(() => setSearchResult(null), [setSearchResult]);
  const {
    runQuery: runSearchQuery,
    loading: searchLoading,
    error: searchError,
  } = useEsqlQuery({
    connection,
    queryContextView,
    onSuccess: handleSearchSuccess,
    onFailure: handleSearchFailure,
  });

  // Trace detail query
  const handleDetailSuccess = useCallback(
    (data: EsqlResponse) => {
      const spans = parseSpansFromEsql(data.columns, data.values, DEFAULT_FIELD_MAPPING);
      setSelectedTraceSpans(spans);
    },
    [setSelectedTraceSpans],
  );
  const {
    runQuery: runDetailQuery,
    loading: detailLoading,
    error: detailError,
  } = useEsqlQuery({
    connection,
    onSuccess: handleDetailSuccess,
  });

  // URL → store: restore trace selection on initial load and browser back/forward.
  // We read selectedTraceId from the store (not as a dependency) to avoid a
  // bidirectional sync loop — the URL is updated directly in handleSelectTrace
  // and clearTraceSelection instead.
  useEffect(() => {
    const currentTraceId = useTracesStore.getState().selectedTraceId;
    if (urlTraceId !== currentTraceId) {
      setSelectedTraceId(urlTraceId);
      if (urlTraceId) {
        runDetailQuery(buildTraceDetailQuery(urlTraceId));
      } else {
        setSelectedTraceSpans([]);
      }
    }
  }, [urlTraceId, setSelectedTraceId, runDetailQuery, setSelectedTraceSpans]);

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
      setSearchResult(null);
      setTimeseriesResult(null);
      runSearchQuery(query);
      if (includeTimeseries) {
        runTimeseriesQuery(buildTraceTimeseriesQuery(updatedFilters));
      }
    },
    [filters, rawQuery, runSearchQuery, runTimeseriesQuery, setSearchResult, setTimeseriesResult],
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

  /** Apply a quick-filter update and immediately re-run queries so searchResults stay in sync. */
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
      void setUrlTraceId(traceId);
      runDetailQuery(buildTraceDetailQuery(traceId));
    },
    [setSelectedTraceId, setUrlTraceId, runDetailQuery],
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
    void setUrlTraceId(null);
  }, [setSelectedTraceId, setUrlTraceId]);

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

  // Parse trace searchResults for display
  const traceRows = useMemo(() => {
    if (!searchResult) return [];
    const colIndex = new Map<string, number>();
    for (let i = 0; i < searchResult.columns.length; i++) {
      colIndex.set(searchResult.columns[i]!.name, i);
    }
    const get = (row: unknown[], field: string): unknown => {
      const idx = colIndex.get(field);
      return idx !== undefined ? row[idx] : null;
    };

    return searchResult.values.map((row) => {
      const parsedDurationUs = Number(get(row, DEFAULT_FIELD_MAPPING.durationUs) ?? NaN);
      const parsedDurationNs = Number(get(row, DEFAULT_FIELD_MAPPING.durationNs) ?? NaN);
      const durationUs =
        Number.isFinite(parsedDurationUs) && parsedDurationUs > 0
          ? parsedDurationUs
          : Number.isFinite(parsedDurationNs) && parsedDurationNs > 0
            ? parsedDurationNs / 1000
            : 0;
      return {
        traceId: String(get(row, DEFAULT_FIELD_MAPPING.traceId) ?? ""),
        spanId: String(get(row, DEFAULT_FIELD_MAPPING.spanId) ?? ""),
        serviceName: String(get(row, DEFAULT_FIELD_MAPPING.serviceName) ?? "unknown"),
        name: String(get(row, DEFAULT_FIELD_MAPPING.spanName) ?? ""),
        durationUs,
        status: formatStatusLabel(String(get(row, DEFAULT_FIELD_MAPPING.statusCode) ?? "OK")),
        timestamp: String(get(row, DEFAULT_FIELD_MAPPING.timestamp) ?? ""),
      };
    });
  }, [searchResult]);

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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: "100%" }}>
      <TraceSearchPanel
        filters={filters}
        resetFilters={resetFilters}
        applyFiltersAndRun={applyFiltersAndRun}
        effectiveQuery={effectiveQuery}
        onRawQueryChange={(val) => setRawQuery(val)}
        onCreateEditor={(view) => setQueryContextView(view)}
        queryEditorExtensions={queryEditorExtensions}
        themeMode={themeMode}
        searchLoading={searchLoading}
        onSearch={handleSearch}
        searchResultCount={searchResult ? searchResult.values.length : null}
        collapsed={traceSearchCollapsed}
        onToggleCollapsed={() => setTraceSearchCollapsed(!traceSearchCollapsed)}
      />

      <TraceErrorAlerts
        errors={[
          searchError,
          detailError,
          timeseriesError,
          driftRadarError,
          driftRadarBaselineError,
        ]}
      />

      {/* Content area */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          flex: 1,
          gap: 1,
          minHeight: 0,
        }}
      >
        {/* Results panel */}
        <Box
          sx={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {selectedTraceId ? (
            <ResizableSplitPane
              /* 45 % top / 55 % bottom keeps the waterfall chart majority-visible on load */
              initialTopFraction={0.45}
              minPaneHeight={140}
              top={
                <TraceResultsView
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  searchResult={searchResult}
                  searchLoading={searchLoading}
                  traceRows={traceRows}
                  selectedTraceId={selectedTraceId}
                  onSelectTrace={handleSelectTrace}
                  maxDuration={maxDuration}
                  rawQuery={rawQuery}
                  timeseriesLoading={timeseriesLoading}
                  timeseriesResult={timeseriesResult}
                  detailLoading={detailLoading}
                  selectedTraceSpans={selectedTraceSpans}
                  onServiceMapNodeClick={handleServiceMapNodeClick}
                  driftRadarLoading={driftRadarLoading}
                  driftRadarBaselineLoading={driftRadarBaselineLoading}
                  driftRadarSpans={driftRadarSpans}
                  driftRadarBaselineSpans={driftRadarBaselineSpans}
                  driftRadarBaselineEnabled={driftRadarBaselineEnabled}
                  onDriftRadarBaselineChange={setDriftRadarBaselineEnabled}
                  filters={filters}
                  onSearch={handleSearch}
                />
              }
              bottom={
                <TraceDetailPanel
                  selectedTraceId={selectedTraceId}
                  selectedTraceSpans={selectedTraceSpans}
                  detailLoading={detailLoading}
                  selectedSpanId={selectedSpanId}
                  onSpanClick={(spanId) => setSelectedSpanId(spanId)}
                  onOpenInQueryLab={() =>
                    handleOpenInDiscover(
                      selectedTraceId,
                      selectedRootSpanId,
                      selectedTraceTimestamp,
                    )
                  }
                  onClose={clearTraceSelection}
                />
              }
            />
          ) : (
            <TraceResultsView
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              searchResult={searchResult}
              searchLoading={searchLoading}
              traceRows={traceRows}
              selectedTraceId={selectedTraceId}
              onSelectTrace={handleSelectTrace}
              maxDuration={maxDuration}
              rawQuery={rawQuery}
              timeseriesLoading={timeseriesLoading}
              timeseriesResult={timeseriesResult}
              detailLoading={detailLoading}
              selectedTraceSpans={selectedTraceSpans}
              onServiceMapNodeClick={handleServiceMapNodeClick}
              driftRadarLoading={driftRadarLoading}
              driftRadarBaselineLoading={driftRadarBaselineLoading}
              driftRadarSpans={driftRadarSpans}
              driftRadarBaselineSpans={driftRadarBaselineSpans}
              driftRadarBaselineEnabled={driftRadarBaselineEnabled}
              onDriftRadarBaselineChange={setDriftRadarBaselineEnabled}
              filters={filters}
              onSearch={handleSearch}
            />
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
