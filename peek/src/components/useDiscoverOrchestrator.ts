import { useState, useCallback, useDeferredValue, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { useShallow } from "zustand/react/shallow";

import { useDashboardCatalogStore } from "../store/useDashboardCatalogStore";
import { useDashboardEditorStore } from "../store/useDashboardEditorStore";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { useQueryStore } from "../store/useQueryStore";
import type { EsqlColumn, EsqlResponse } from "../types";
import { DEFAULT_REFRESH_INTERVAL } from "../types";
import type { EsqlQueryParams } from "../services/es";
import { useEsqlQuery } from "../hooks/useEsqlQuery";
import { buildPersesEsqlRequest } from "../services/perses/esqlDatasource";

import {
  filterColumnsByName,
  filterEsqlResult,
  formatEsqlQuery,
  toCsv,
  applyEsqlSort,
  buildColumnInsightsQuery,
} from "./discoverUtils";
import type { SortState } from "./visualizations/DataTable";
import { createEsqlQueryEditorExtensions } from "./queryEditorExtensions";

export function useDiscoverOrchestrator(mode: "query-lab" | "logs") {
  const isLogsExplorer = mode === "logs";
  const panelTitle = isLogsExplorer ? "Logs Panel" : "Query Lab Panel";
  const connection = useConnectionStore((s) => s.connection);
  const themeMode = useUIStore((s) => s.themeMode);
  const addPanel = useDashboardEditorStore((s) => s.addPanel);
  const activeDashboardId = useDashboardCatalogStore((s) => s.activeDashboardId);
  const setEditingPanelId = useUIStore((s) => s.setEditingPanelId);
  const discoverEditorHeight = useUIStore((s) => s.discoverEditorHeight);
  const setDiscoverEditorHeight = useUIStore((s) => s.setDiscoverEditorHeight);
  const [editorFocused, setEditorFocused] = useState(false);
  const {
    discoverQueryDraft,
    setDiscoverQueryDraft,
    queryHistory,
    appendQueryToHistory,
    query,
    setQuery,
    result,
    setResult,
    selectedFields,
    setSelectedFields,
  } = useQueryStore(
    useShallow((s) => ({
      discoverQueryDraft: s.discoverQueryDraft,
      setDiscoverQueryDraft: s.setDiscoverQueryDraft,
      queryHistory: s.queryHistory,
      appendQueryToHistory: s.appendQueryToHistory,
      query: s.discoverSessionQuery,
      setQuery: s.setDiscoverSessionQuery,
      result: s.discoverSessionResult,
      setResult: s.setDiscoverSessionResult,
      selectedFields: s.discoverSelectedFields,
      setSelectedFields: s.setDiscoverSelectedFields,
    })),
  );
  const refreshInterval = useDashboardEditorStore(
    (s) => s.dashboard.refreshInterval ?? DEFAULT_REFRESH_INTERVAL,
  );
  const timeRange = useDashboardEditorStore((s) => s.dashboard.timeRange);
  const parameters = useDashboardEditorStore((s) => s.dashboard.parameters);
  const navigate = useNavigate();
  const [queryContextView, setQueryContextView] = useState<EditorView | null>(null);
  const [fieldFilter, setFieldFilter] = useState("");
  const deferredFieldFilter = useDeferredValue(fieldFilter);
  const [tableVersion, setTableVersion] = useState(0);
  const [historyAnchor, setHistoryAnchor] = useState<HTMLElement | null>(null);
  const [currentSort, setCurrentSort] = useState<SortState | null>(null);
  const [profileMode, setProfileMode] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [insightsCache, setInsightsCache] = useState<
    Record<string, { loading: boolean; error: string | null; data: EsqlResponse | null }>
  >({});
  const effectiveQuery = discoverQueryDraft ?? query;
  const buildRequest = useCallback(
    (queryText: string): EsqlQueryParams =>
      buildPersesEsqlRequest(queryText, { timeRange, parameters }),
    [timeRange, parameters],
  );
  const timingsCleared = useRef(false);
  const {
    runQuery,
    loading,
    error,
    activeStep,
    stepDurationsMs,
    clearTimings,
    lastRunDurationMs,
    lastRunProfile,
    lastRunIsPartial,
    lastRunPartialMetadata,
  } = useEsqlQuery({
    connection,
    queryContextView,
    profileMode,
    buildRequest,
    onSuccess: (data, executedQuery, executedStepIndex) => {
      setResult(data);
      appendQueryToHistory(executedQuery);
      if (executedStepIndex === null) {
        if (discoverQueryDraft) setDiscoverQueryDraft(null);
        setQuery(executedQuery);
      }
      // Select a focused default column set when there are many fields;
      // fall back to all fields when the result set is small.
      const allNames = data.columns.map((c) => c.name);
      const DEFAULT_FIELD_LIMIT = 10;
      if (allNames.length <= DEFAULT_FIELD_LIMIT) {
        setSelectedFields(new Set(allNames));
      } else {
        const PREFERRED_FIELDS = [
          "@timestamp",
          "message",
          "host.name",
          "service.name",
          "log.level",
          "event.dataset",
          "agent.name",
        ];
        const preferred = PREFERRED_FIELDS.filter((f) => allNames.includes(f));
        setSelectedFields(
          new Set(preferred.length > 0 ? preferred : allNames.slice(0, DEFAULT_FIELD_LIMIT)),
        );
      }
      setTableVersion((prev) => prev + 1);
      timingsCleared.current = false;
    },
    onFailure: () => {
      setResult(null);
    },
  });
  const insightQueryToColumnRef = useRef(new Map<string, string>());
  const { runQuery: runInsightQuery } = useEsqlQuery({
    connection,
    buildRequest,
    onSuccess: (data, executedQuery) => {
      const col = insightQueryToColumnRef.current.get(executedQuery);
      if (!col) return;
      insightQueryToColumnRef.current.delete(executedQuery);
      setInsightsCache((prev) => ({ ...prev, [col]: { loading: false, error: null, data } }));
    },
    onFailure: (failedQuery) => {
      const col = insightQueryToColumnRef.current.get(failedQuery);
      if (!col) return;
      insightQueryToColumnRef.current.delete(failedQuery);
      setInsightsCache((prev) => ({
        ...prev,
        [col]: { loading: false, error: "Query failed", data: null },
      }));
    },
  });
  const handleToggleInsight = useCallback(
    (columnName: string, columnType: string) => {
      if (expandedInsight === columnName) {
        setExpandedInsight(null);
        return;
      }
      setExpandedInsight(columnName);
      // Use cache only for completed successful results; allow retry after errors
      const cached = insightsCache[columnName];
      if (cached?.loading) return;
      if (cached?.data) return;
      // Fire query
      const insightsQuery = buildColumnInsightsQuery(effectiveQuery, columnName, columnType);
      if (!insightsQuery) return;
      insightQueryToColumnRef.current.set(insightsQuery, columnName);
      setInsightsCache((prev) => ({
        ...prev,
        [columnName]: { loading: true, error: null, data: null },
      }));
      void runInsightQuery(insightsQuery);
    },
    [expandedInsight, insightsCache, effectiveQuery, runInsightQuery],
  );
  const handleRunQuery = useCallback(() => runQuery(effectiveQuery), [runQuery, effectiveQuery]);
  const handleQueryChange = useCallback(
    (nextQuery: string) => {
      if (discoverQueryDraft) setDiscoverQueryDraft(null);
      if (!timingsCleared.current) {
        clearTimings();
        timingsCleared.current = true;
      }
      setQuery(nextQuery);
      setCurrentSort(null);
      setInsightsCache({});
      setExpandedInsight(null);
      insightQueryToColumnRef.current.clear();
    },
    [discoverQueryDraft, setDiscoverQueryDraft, clearTimings, setQuery],
  );
  const handleFormatQuery = useCallback(
    () => handleQueryChange(formatEsqlQuery(effectiveQuery)),
    [effectiveQuery, handleQueryChange],
  );
  const handleRerunHealthyClusters = useCallback(
    (healthyClusters: string[]) => {
      const scoped = effectiveQuery.replace(
        /\bFROM\s+\*:([^\s,|]+)/gi,
        (_: string, pattern: string) =>
          `FROM ${healthyClusters.map((c) => `${c}:${pattern}`).join(", ")}`,
      );
      handleQueryChange(scoped);
      void runQuery(scoped);
    },
    [effectiveQuery, handleQueryChange, runQuery],
  );
  const handleRunStep = useCallback(
    (stepQuery: string, stepIndex: number) => runQuery(stepQuery, stepIndex),
    [runQuery],
  );
  const handleSortChange = useCallback(
    (columnName: string, direction: "asc" | "desc" | null) => {
      const newSort = direction ? { columnName, direction } : null;
      setCurrentSort(newSort);
      const newQuery = applyEsqlSort(effectiveQuery, columnName, direction);
      if (discoverQueryDraft) setDiscoverQueryDraft(null);
      setQuery(newQuery);
      void runQuery(newQuery);
    },
    [effectiveQuery, discoverQueryDraft, setDiscoverQueryDraft, setQuery, runQuery],
  );
  const handleSelectHistory = useCallback(
    (selectedQuery: string) => {
      setDiscoverQueryDraft(null);
      clearTimings();
      setQuery(selectedQuery);
      setCurrentSort(null);
      setInsightsCache({});
      setExpandedInsight(null);
      insightQueryToColumnRef.current.clear();
      setHistoryAnchor(null);
    },
    [setDiscoverQueryDraft, clearTimings, setQuery],
  );
  const handleRunQueryRef = useRef(handleRunQuery);
  useEffect(() => {
    handleRunQueryRef.current = handleRunQuery;
  }, [handleRunQuery]);
  const stableRunQuery = useCallback(() => {
    handleRunQueryRef.current();
  }, []);
  const queryEditorExtensions = useMemo<Extension[]>(
    () => [
      EditorView.lineWrapping,
      ...createEsqlQueryEditorExtensions(stableRunQuery),
      EditorView.focusChangeEffect.of((_state, focusing) => {
        setEditorFocused(focusing);
        return null;
      }),
    ],
    // stableRunQuery is stable (useCallback([], [])); setEditorFocused is a stable useState setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const basicSetup = useMemo(
    () => ({ lineNumbers: true, foldGutter: false, indentOnInput: false }),
    [],
  );

  const handleCreateEditor = useCallback((view: EditorView) => setQueryContextView(view), []);
  useEffect(() => {
    if (!connection || !refreshInterval || !effectiveQuery.trim()) return;
    const id = setInterval(() => {
      if (loading) return;
      handleRunQuery();
    }, refreshInterval * 1000);
    return () => clearInterval(id);
  }, [connection, refreshInterval, effectiveQuery, loading, handleRunQuery]);
  const toggleField = useCallback(
    (name: string) => {
      const next = new Set(selectedFields);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      setSelectedFields(next);
      setTableVersion((prev) => prev + 1);
    },
    [selectedFields, setSelectedFields],
  );
  const handleCreatePanel = useCallback(() => {
    const newPanel = {
      id: crypto.randomUUID(),
      title: panelTitle,
      query: effectiveQuery.trim(),
      visualization: "table" as const,
      layout: { x: 0, y: Infinity, w: 12, h: 5 },
    };
    addPanel(newPanel);
    setEditingPanelId(newPanel.id);
    navigate(`/dashboards/${activeDashboardId}`);
  }, [effectiveQuery, panelTitle, addPanel, setEditingPanelId, navigate, activeDashboardId]);
  const filteredResult: EsqlResponse | null = useMemo(
    () => filterEsqlResult(result, selectedFields),
    [result, selectedFields],
  );
  const handleExportCsv = useCallback(() => {
    if (!filteredResult || filteredResult.columns.length === 0) return;
    const csv = toCsv(filteredResult);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isLogsExplorer ? "logs-explorer-results.csv" : "query-lab-results.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [filteredResult, isLogsExplorer]);
  const columns = useMemo<EsqlColumn[]>(() => result?.columns ?? [], [result]);
  const visibleColumns = useMemo(
    () => filterColumnsByName(columns, deferredFieldFilter),
    [columns, deferredFieldFilter],
  );
  const selectVisibleFields = useCallback(() => {
    const next = new Set(selectedFields);
    for (const col of visibleColumns) next.add(col.name);
    setSelectedFields(next);
    setTableVersion((prev) => prev + 1);
  }, [selectedFields, setSelectedFields, visibleColumns]);
  const deselectVisibleFields = useCallback(() => {
    const next = new Set(selectedFields);
    for (const col of visibleColumns) next.delete(col.name);
    setSelectedFields(next);
    setTableVersion((prev) => prev + 1);
  }, [selectedFields, setSelectedFields, visibleColumns]);

  return {
    // Mode
    isLogsExplorer,

    // Theme
    themeMode,

    // Editor state
    editorFocused,
    discoverEditorHeight,
    setDiscoverEditorHeight,
    effectiveQuery,
    handleQueryChange,
    handleCreateEditor,
    queryEditorExtensions,
    basicSetup,

    // Query execution
    loading,
    error,
    activeStep,
    stepDurationsMs,
    handleRunQuery,
    handleRunStep,
    profileMode,
    setProfileMode,
    lastRunDurationMs,
    lastRunProfile,
    lastRunIsPartial,
    lastRunPartialMetadata,
    handleRerunHealthyClusters,

    // Results
    result,
    filteredResult,
    tableVersion,

    // History
    queryHistory,
    historyAnchor,
    setHistoryAnchor,
    handleSelectHistory,

    // Format & panel
    handleFormatQuery,
    handleCreatePanel,

    // Table
    currentSort,
    handleSortChange,
    handleExportCsv,

    // Field picker
    columns,
    selectedFields,
    toggleField,
    fieldFilter,
    setFieldFilter,
    selectVisibleFields,
    deselectVisibleFields,
    visibleColumns,

    // Insights
    expandedInsight,
    insightsCache,
    handleToggleInsight,
  };
}
