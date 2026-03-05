import { useState, useCallback, useMemo, useEffect } from "react";
import type { EditorView } from "@codemirror/view";
import { parseAsString, useQueryState } from "nuqs";

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { useOpenInDiscover } from "../../hooks/useOpenInDiscover";
import { useConnectionStore } from "../../store/useConnectionStore";
import { useDashboardEditorStore } from "../../store/useDashboardEditorStore";
import { useTracesStore } from "../../store/useTracesStore";
import { useSearchPanelUIStore } from "../../store/useSearchPanelUIStore";
import type { EsqlResponse } from "../../types";
import { toTraceTimeRange } from "../timePresets";
import { formatEsqlQuery } from "../discoverUtils";

import { parseSpansFromEsql, formatStatusLabel } from "./traceUtils";
import type { Span } from "./traceUtils";
import {
  buildTraceSearchQuery,
  buildTraceDetailQuery,
  buildTraceSpansForTraceIdsQuery,
  buildTraceTimeseriesQuery,
  buildTraceQueryLabDraft,
  buildDriftRadarQuery,
  shiftTimeRangeBack,
  DEFAULT_FIELD_MAPPING,
} from "./traceQueryBuilder";
import type { TraceFilters } from "./traceQueryBuilder";

export function useTracesOrchestrator() {
  const openInDiscover = useOpenInDiscover();
  const connection = useConnectionStore((s) => s.connection);

  const filters = useTracesStore((s) => s.filters);
  const rawQuery = useTracesStore((s) => s.rawQuery);
  const setRawQuery = useTracesStore((s) => s.setRawQuery);
  const updateFilters = useTracesStore((s) => s.updateFilters);
  const setTimeRange = useTracesStore((s) => s.setTimeRange);
  const selectedTraceId = useTracesStore((s) => s.selectedTraceId);
  const setSelectedTraceId = useTracesStore((s) => s.setSelectedTraceId);
  const setSelectedTraceSpans = useTracesStore((s) => s.setSelectedTraceSpans);
  const selectedTraceSpans = useTracesStore((s) => s.selectedTraceSpans);
  const selectedSpanId = useTracesStore((s) => s.selectedSpanId);
  const setSelectedSpanId = useTracesStore((s) => s.setSelectedSpanId);
  const drawerOpen = useTracesStore((s) => s.drawerOpen);
  const setDrawerOpen = useTracesStore((s) => s.setDrawerOpen);
  const viewMode = useTracesStore((s) => s.viewMode);
  const setViewMode = useTracesStore((s) => s.setViewMode);
  const resetFilters = useTracesStore((s) => s.resetFilters);
  const [searchResult, setSearchResult] = useState<EsqlResponse | null>(null);
  const [searchTraceSpans, setSearchTraceSpans] = useState<Span[]>([]);
  const [timeseriesResult, setTimeseriesResult] = useState<EsqlResponse | null>(null);

  // Sync the global AppHeader time range into trace filters (without clearing rawQuery)
  const dashboardTimeRange = useDashboardEditorStore((s) => s.dashboard.timeRange);
  useEffect(() => {
    const { from, to } = toTraceTimeRange(dashboardTimeRange);
    const { filters: currentFilters } = useTracesStore.getState();
    if (currentFilters.timeFrom === from && currentFilters.timeTo === to) return;
    setTimeRange(from, to);
  }, [dashboardTimeRange, setTimeRange]);

  const [queryContextView, setQueryContextView] = useState<EditorView | null>(null);
  const [selectedTraceTimestamp, setSelectedTraceTimestamp] = useState<string | null>(null);
  const [selectedRootSpanId, setSelectedRootSpanId] = useState<string | null>(null);

  // Sync selectedTraceId with URL query parameter
  const [urlTraceId, setUrlTraceId] = useQueryState("traceId", parseAsString);

  // Drift Radar state
  const [driftRadarSpans, setDriftRadarSpans] = useState<Span[]>([]);
  const [driftRadarBaselineSpans, setDriftRadarBaselineSpans] = useState<Span[] | null>(null);
  const [driftRadarBaselineEnabled, setDriftRadarBaselineEnabled] = useState(false);

  const traceSearchCollapsed = useSearchPanelUIStore((s) => s.traceSearchCollapsed);
  const setTraceSearchCollapsed = useSearchPanelUIStore((s) => s.setTraceSearchCollapsed);
  const traceMetricsChartsCollapsed = useSearchPanelUIStore((s) => s.traceMetricsChartsCollapsed);
  const setTraceMetricsChartsCollapsed = useSearchPanelUIStore(
    (s) => s.setTraceMetricsChartsCollapsed,
  );
  const traceEditorHeight = useSearchPanelUIStore((s) => s.traceEditorHeight);
  const setTraceEditorHeight = useSearchPanelUIStore((s) => s.setTraceEditorHeight);

  const generatedQuery = useMemo(
    () => buildTraceSearchQuery(filters, DEFAULT_FIELD_MAPPING, { limit: 500 }),
    [filters],
  );
  const effectiveQuery = rawQuery ?? generatedQuery;

  // Cmd/Ctrl+[ toggles the search panel collapse
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "[" && !e.repeat) {
        e.preventDefault();
        setTraceSearchCollapsed(!useSearchPanelUIStore.getState().traceSearchCollapsed);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setTraceSearchCollapsed]);

  const {
    runQuery: runSearchSpansQuery,
    loading: searchSpansLoading,
    error: searchSpansError,
  } = useEsqlQuery({
    connection,
    onSuccess: (data) =>
      setSearchTraceSpans(parseSpansFromEsql(data.columns, data.values, DEFAULT_FIELD_MAPPING)),
    onFailure: () => setSearchTraceSpans([]),
  });

  // Main search query
  const handleSearchSuccess = useCallback(
    (data: EsqlResponse) => {
      setSearchResult(data);
      const traceIdColumnIndex = data.columns.findIndex(
        (c) => c.name === DEFAULT_FIELD_MAPPING.traceId,
      );
      if (traceIdColumnIndex < 0) {
        setSearchTraceSpans([]);
        return;
      }
      const traceIds = Array.from(
        new Set(
          data.values
            .map((row) => String(row[traceIdColumnIndex] ?? ""))
            .filter((id) => id.length > 0),
        ),
      );
      if (traceIds.length === 0) {
        setSearchTraceSpans([]);
        return;
      }
      runSearchSpansQuery(buildTraceSpansForTraceIdsQuery(traceIds));
    },
    [setSearchResult, runSearchSpansQuery],
  );
  const handleSearchFailure = useCallback(() => {
    setSearchResult(null);
    setSearchTraceSpans([]);
  }, [setSearchResult]);
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
    onFailure: () => {
      setSelectedTraceSpans([]);
      setSelectedSpanId(null);
      setDrawerOpen(false);
    },
  });

  // URL → store: restore trace selection on initial load and browser back/forward.
  useEffect(() => {
    const currentTraceId = useTracesStore.getState().selectedTraceId;
    if (urlTraceId !== currentTraceId) {
      setSelectedTraceId(urlTraceId);
      if (urlTraceId) {
        setSelectedTraceSpans([]);
        setSelectedSpanId(null);
        setDrawerOpen(false);
        runDetailQuery(buildTraceDetailQuery(urlTraceId));
      } else {
        setSelectedTraceSpans([]);
        setSelectedSpanId(null);
        setDrawerOpen(false);
        queueMicrotask(() => {
          setSelectedRootSpanId(null);
          setSelectedTraceTimestamp(null);
        });
      }
    }
  }, [
    urlTraceId,
    setSelectedTraceId,
    runDetailQuery,
    setSelectedTraceSpans,
    setSelectedSpanId,
    setDrawerOpen,
    setSelectedRootSpanId,
    setSelectedTraceTimestamp,
  ]);

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
    (query: string, updatedFilters = filters) => {
      setSearchResult(null);
      setSearchTraceSpans([]);
      setTimeseriesResult(null);
      runSearchQuery(query);
      // Always run timeseries for charts; use time-only filters when user has raw query
      const chartFilters =
        rawQuery != null
          ? {
              ...updatedFilters,
              services: [],
              operations: [],
              statusCodes: [],
              minDurationMs: null,
              maxDurationMs: null,
              tags: [],
            }
          : updatedFilters;
      runTimeseriesQuery(buildTraceTimeseriesQuery(chartFilters));
    },
    [
      filters,
      rawQuery,
      runSearchQuery,
      runTimeseriesQuery,
      setSearchResult,
      setSearchTraceSpans,
      setTimeseriesResult,
    ],
  );

  const runDriftRadarQueries = useCallback(
    (updatedFilters: TraceFilters, baselineEnabled = driftRadarBaselineEnabled) => {
      if (viewMode !== "driftRadar" || rawQuery != null) return;

      setDriftRadarSpans([]);
      setDriftRadarBaselineSpans(null);
      runDriftRadarQuery(buildDriftRadarQuery(updatedFilters));
      if (baselineEnabled && updatedFilters.timeFrom) {
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

  const handleDriftRadarBaselineChange = useCallback(
    (enabled: boolean) => {
      setDriftRadarBaselineEnabled(enabled);
      const updatedFilters = useTracesStore.getState().filters;
      runDriftRadarQueries(updatedFilters, enabled);
    },
    [runDriftRadarQueries],
  );

  /** Apply a quick-filter update and immediately re-run queries so searchResults stay in sync. */
  const applyFiltersAndRun = useCallback(
    (updates: Partial<TraceFilters>) => {
      updateFilters(updates);
      const updatedFilters = useTracesStore.getState().filters;
      runTraceQueries(
        buildTraceSearchQuery(updatedFilters, DEFAULT_FIELD_MAPPING, { limit: 500 }),
        updatedFilters,
      );
      runDriftRadarQueries(updatedFilters);
    },
    [updateFilters, runTraceQueries, runDriftRadarQueries],
  );

  const handleSearch = useCallback(() => {
    runTraceQueries(effectiveQuery, filters);
    runDriftRadarQueries(filters);
  }, [runTraceQueries, runDriftRadarQueries, effectiveQuery, filters]);

  const handleFormatQuery = useCallback(() => {
    const formatted = formatEsqlQuery(effectiveQuery);
    if (formatted !== effectiveQuery) setRawQuery(formatted);
  }, [effectiveQuery, setRawQuery]);

  // Auto-execute search when navigating from another page with pendingSearch flag
  useEffect(() => {
    const { pendingSearch } = useTracesStore.getState();
    if (!pendingSearch) return;
    useTracesStore.getState().setPendingSearch(false);
    const { filters: latestFilters } = useTracesStore.getState();
    // Defer to avoid calling setState synchronously within an effect
    const id = setTimeout(() => {
      runTraceQueries(
        buildTraceSearchQuery(latestFilters, DEFAULT_FIELD_MAPPING, { limit: 500 }),
        latestFilters,
      );
      runDriftRadarQueries(latestFilters);
    }, 0);
    return () => clearTimeout(id);
  }, [runTraceQueries, runDriftRadarQueries]);

  const handleSelectTrace = useCallback(
    (traceId: string, spanId?: string, timestamp?: string) => {
      setSelectedTraceId(traceId);
      setSelectedRootSpanId(spanId ?? null);
      setSelectedTraceTimestamp(timestamp ?? null);
      setSelectedTraceSpans([]);
      setSelectedSpanId(null);
      setDrawerOpen(false);
      void setUrlTraceId(traceId);
      runDetailQuery(buildTraceDetailQuery(traceId));
    },
    [
      setSelectedTraceId,
      setSelectedTraceSpans,
      setSelectedSpanId,
      setDrawerOpen,
      setUrlTraceId,
      runDetailQuery,
    ],
  );

  const handleOpenInDiscover = useCallback(
    (traceId: string, spanId?: string | null, timestamp?: string | null) => {
      openInDiscover(buildTraceQueryLabDraft({ traceId, spanId, timestamp }));
    },
    [openInDiscover],
  );

  const clearTraceSelection = useCallback(() => {
    setSelectedTraceId(null);
    setSelectedTraceSpans([]);
    setSelectedSpanId(null);
    setDrawerOpen(false);
    setSelectedRootSpanId(null);
    setSelectedTraceTimestamp(null);
    void setUrlTraceId(null);
  }, [setSelectedTraceId, setSelectedTraceSpans, setSelectedSpanId, setDrawerOpen, setUrlTraceId]);

  const handleServiceMapNodeClick = useCallback(
    (serviceName: string) => {
      const state = useTracesStore.getState();
      const services = state.filters.services.includes(serviceName)
        ? state.filters.services
        : [...state.filters.services, serviceName];
      state.updateFilters({ services });
      const updatedFilters = useTracesStore.getState().filters;
      runTraceQueries(
        buildTraceSearchQuery(updatedFilters, DEFAULT_FIELD_MAPPING, { limit: 500 }),
        updatedFilters,
      );
      runDriftRadarQueries(updatedFilters);
    },
    [runTraceQueries, runDriftRadarQueries],
  );

  // Parse search results into full Span[] for SpanTreeView
  const searchSpans = searchTraceSpans;

  const handleSelectSpan = useCallback(
    (spanId: string) => {
      setSelectedSpanId(spanId);
      setDrawerOpen(true);
    },
    [setSelectedSpanId, setDrawerOpen],
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
    () =>
      selectedTraceSpans.find((s) => s.spanId === selectedSpanId) ??
      searchTraceSpans.find((s) => s.spanId === selectedSpanId) ??
      null,
    [selectedTraceSpans, searchTraceSpans, selectedSpanId],
  );

  const handleDrawerFilterBy = useCallback(
    (key: string, value: string) => {
      useTracesStore.getState().addTagFilter(key, value, false);
      const updatedFilters = useTracesStore.getState().filters;
      runTraceQueries(
        buildTraceSearchQuery(updatedFilters, DEFAULT_FIELD_MAPPING, { limit: 500 }),
        updatedFilters,
      );
      runDriftRadarQueries(updatedFilters);
    },
    [runTraceQueries, runDriftRadarQueries],
  );

  const handleDrawerExclude = useCallback(
    (key: string, value: string) => {
      useTracesStore.getState().addTagFilter(key, value, true);
      const updatedFilters = useTracesStore.getState().filters;
      runTraceQueries(
        buildTraceSearchQuery(updatedFilters, DEFAULT_FIELD_MAPPING, { limit: 500 }),
        updatedFilters,
      );
      runDriftRadarQueries(updatedFilters);
    },
    [runTraceQueries, runDriftRadarQueries],
  );

  const handleDrawerOpenInQueryLab = useCallback(
    (spanContext: { traceId: string; spanId?: string; timestamp?: string }) => {
      handleOpenInDiscover(spanContext.traceId, spanContext.spanId, spanContext.timestamp);
    },
    [handleOpenInDiscover],
  );

  return {
    // Filters & state
    filters,
    resetFilters,
    applyFiltersAndRun,
    effectiveQuery,
    setRawQuery,
    rawQuery,
    viewMode,
    setViewMode,
    selectedTraceId,
    selectedTraceSpans,
    selectedSpanId,
    setSelectedSpanId,
    drawerOpen,
    setDrawerOpen,

    // Editor
    queryContextView,
    setQueryContextView,

    // Query loading & errors
    searchLoading,
    searchSpansLoading,
    searchSpansError,
    searchError,
    detailLoading,
    detailError,
    timeseriesLoading,
    timeseriesError,
    driftRadarLoading,
    driftRadarError,
    driftRadarBaselineLoading,
    driftRadarBaselineError,

    // Results
    searchResult,
    timeseriesResult,
    traceRows,
    maxDuration,
    selectedSpan,
    searchSpans,
    handleSelectSpan,

    // Drift radar
    driftRadarSpans,
    driftRadarBaselineSpans,
    driftRadarBaselineEnabled,
    handleDriftRadarBaselineChange,

    // Handlers
    handleSearch,
    handleFormatQuery,
    handleSelectTrace,
    handleOpenInDiscover,
    clearTraceSelection,
    handleServiceMapNodeClick,
    selectedRootSpanId,
    selectedTraceTimestamp,

    // Search panel collapse & editor
    traceSearchCollapsed,
    setTraceSearchCollapsed,
    traceMetricsChartsCollapsed,
    setTraceMetricsChartsCollapsed,
    traceEditorHeight,
    setTraceEditorHeight,

    // Drawer handlers
    handleDrawerFilterBy,
    handleDrawerExclude,
    handleDrawerOpenInQueryLab,
  };
}
