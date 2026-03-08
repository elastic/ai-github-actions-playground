import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { EditorView } from "@codemirror/view";
import { useQueries } from "@tanstack/react-query";

import { ElasticsearchClient, getFieldValues } from "../../services/es";
import {
  buildColumnLookup,
  findColumnIndex,
  getColumnIndex,
  getRowValue,
} from "../../services/es/columnUtils";
import { useConnectionStore } from "../../store/useConnectionStore";
import { useThemeStore } from "../../store/useThemeStore";
import { useSearchPanelUIStore } from "../../store/useSearchPanelUIStore";
import { useLogsStore } from "../../store/useLogsStore";
import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { useOpenInDiscover } from "../../hooks/useOpenInDiscover";
import { INSIGHT_GUARDRAIL } from "../../hooks/insightPromptUtils";
import { usePageSlotInsights } from "../../hooks/usePageSlotInsights";
import { createEsqlQueryEditorExtensions } from "../queryEditorExtensions";
import { useQueryExplanation } from "../QueryAnnotationOverlay";
import { escapeEsqlString } from "../../services/es/esqlUtils";

import { buildLogsQuery } from "./logsQueryBuilder";
import { LOGS_INSIGHT_SLOTS } from "./logsInsightSlots";
import { useLogsQueryExperiences } from "./useLogsQueryExperiences";
import {
  type ExtractMethod,
  type HistogramBucket,
  type LogsViewMode,
  HISTOGRAM_INTERVAL_MS,
  MESSAGE_FIELD,
  SIDEBAR_FIELDS,
  TIMESTAMP_FIELD,
  normalizePattern,
} from "./logsUtils";

const HISTOGRAM_INTERVAL_MINUTES = HISTOGRAM_INTERVAL_MS / (60 * 1000);

const LOGS_SYSTEM_PROMPT =
  "You are a log analysis assistant for Elasticsearch." +
  " Analyse the current log exploration context and produce per-slot insights." +
  INSIGHT_GUARDRAIL;

/** All state, memos, and callbacks for the LogsPage component. */
export function useLogsPageState() {
  const openInDiscover = useOpenInDiscover();
  const connection = useConnectionStore((s) => s.connection);
  const themeMode = useThemeStore((s) => s.themeMode);
  const logsSearchCollapsed = useSearchPanelUIStore((s) => s.logsSearchCollapsed);
  const setLogsSearchCollapsed = useSearchPanelUIStore((s) => s.setLogsSearchCollapsed);
  const {
    indexPattern,
    searchText,
    filters,
    selectedColumns,
    rawQuery,
    result,
    setSearchText,
    addFilter,
    removeFilter,
    clearFilters,
    setRawQuery,
    setResult,
  } = useLogsStore(
    useShallow((s) => ({
      indexPattern: s.indexPattern,
      searchText: s.searchText,
      filters: s.filters,
      selectedColumns: s.selectedColumns,
      rawQuery: s.rawQuery,
      result: s.result,
      setSearchText: s.setSearchText,
      addFilter: s.addFilter,
      removeFilter: s.removeFilter,
      clearFilters: s.clearFilters,
      setRawQuery: s.setRawQuery,
      setResult: s.setResult,
    })),
  );
  const [queryContextView, setQueryContextView] = useState<EditorView | null>(null);
  const [extractedSidebarFields, setExtractedSidebarFields] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<LogsViewMode>("lines");
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [extractMethod, setExtractMethod] = useState<ExtractMethod>("DISSECT");
  const [extractPattern, setExtractPattern] = useState("%{extracted.value}");
  const [extractSource, setExtractSource] = useState("");
  const [logsQueryEditorCollapsed, setLogsQueryEditorCollapsed] = useState(true);
  const [logsEditorFocused, setLogsEditorFocused] = useState(false);
  const [logsExplainOpen, setLogsExplainOpen] = useState(false);
  const logsExplainPanelId = useId();

  const handleRunQueryRef = useRef<() => void>(() => undefined);
  const generatedQuery = useMemo(
    () =>
      buildLogsQuery({
        indexPattern,
        searchText,
        filters,
        selectedColumns,
      }),
    [indexPattern, searchText, filters, selectedColumns],
  );
  const effectiveQuery = rawQuery ?? generatedQuery;
  const sidebarFields = useMemo(
    () => Array.from(new Set([...SIDEBAR_FIELDS, ...extractedSidebarFields])),
    [extractedSidebarFields],
  );

  // Derive distinct values for DISSECT/GROK-extracted fields directly from the
  // current query result. These fields are query-time only and do not exist in
  // the index mapping, so calling getFieldValues for them would always fail.
  const extractedFieldValues = useMemo<
    Record<string, Array<{ value: string; count: number }>>
  >(() => {
    if (!result || extractedSidebarFields.length === 0) return {};
    const lookup = buildColumnLookup(result.columns);
    const out: Record<string, Array<{ value: string; count: number }>> = {};
    for (const field of extractedSidebarFields) {
      const colIdx = getColumnIndex(lookup, field);
      if (colIdx < 0) continue;
      const counts = new Map<string, number>();
      for (const row of result.values) {
        const raw = getRowValue(row, colIdx);
        if (raw == null) continue;
        const val = String(raw);
        counts.set(val, (counts.get(val) ?? 0) + 1);
      }
      out[field] = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
    }
    return out;
  }, [result, extractedSidebarFields]);

  const histogramBuckets = useMemo<HistogramBucket[]>(() => {
    if (!result) return [];
    const timestampIndex = findColumnIndex(result.columns, TIMESTAMP_FIELD);
    if (timestampIndex < 0) return [];
    const bucketCounts = new Map<number, number>();
    for (const row of result.values) {
      const rawValue = getRowValue(row, timestampIndex);
      if (rawValue == null) continue;
      const parsed = Date.parse(String(rawValue));
      if (Number.isNaN(parsed)) continue;
      const start = Math.floor(parsed / HISTOGRAM_INTERVAL_MS) * HISTOGRAM_INTERVAL_MS;
      bucketCounts.set(start, (bucketCounts.get(start) ?? 0) + 1);
    }
    const buckets = Array.from(bucketCounts.entries())
      .map(([start, count]) => ({ start, end: start + HISTOGRAM_INTERVAL_MS, count }))
      .sort((a, b) => a.start - b.start);
    if (buckets.length === 0) return [];
    const counts = buckets.map((b) => b.count);
    const mean = counts.reduce((sum, value) => sum + value, 0) / counts.length;
    const variance = counts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / counts.length;
    const deviation = Math.sqrt(variance);
    const threshold = mean + deviation * 2;
    const canDetectAnomaly = buckets.length > 1 && deviation > 0;
    return buckets.map((bucket) => ({
      ...bucket,
      anomaly: canDetectAnomaly && bucket.count > threshold,
    }));
  }, [result]);

  const patternGroups = useMemo(() => {
    if (!result) return [];
    const lookup = buildColumnLookup(result.columns);
    // CATEGORIZE query result shape: has "pattern" and "pattern_count" columns
    const patternColIndex = getColumnIndex(lookup, "pattern");
    const countColIndex = getColumnIndex(lookup, "pattern_count");
    if (patternColIndex >= 0 && countColIndex >= 0) {
      return result.values
        .map((row) => ({
          pattern: String(getRowValue(row, patternColIndex) ?? ""),
          sample: String(getRowValue(row, patternColIndex) ?? ""),
          count: Number(getRowValue(row, countColIndex) ?? 0),
        }))
        .filter((row) => row.pattern.length > 0)
        .sort((a, b) => b.count - a.count);
    }
    // Client-side grouping from raw message rows
    const messageIndex = getColumnIndex(lookup, MESSAGE_FIELD);
    if (messageIndex < 0) return [];
    const groups = new Map<string, { pattern: string; sample: string; count: number }>();
    for (const row of result.values) {
      const raw = getRowValue(row, messageIndex);
      if (raw == null) continue;
      const sample = String(raw);
      const pattern = normalizePattern(sample);
      const existing = groups.get(pattern);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(pattern, { pattern, sample, count: 1 });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }, [result]);

  useEffect(() => {
    setRawQuery(null);
  }, [generatedQuery, setRawQuery]);

  const { runQuery, loading, error } = useEsqlQuery({
    connection,
    queryContextView,
    onSuccess: (data) => setResult(data),
    onFailure: () => setResult(null),
  });

  const runLogsQuery = useCallback(() => {
    void runQuery(effectiveQuery);
  }, [runQuery, effectiveQuery]);

  handleRunQueryRef.current = runLogsQuery;

  const queryEditorExtensions = useMemo(
    () => [
      EditorView.contentAttributes.of({ "aria-label": "ES|QL query editor" }),
      EditorView.lineWrapping,
      ...createEsqlQueryEditorExtensions(() => handleRunQueryRef.current()),
    ],
    [],
  );
  const logsQueryEditorExtensions = useMemo(
    () => [
      ...queryEditorExtensions,
      EditorView.focusChangeEffect.of((_state, focusing) => {
        setLogsEditorFocused(focusing);
        return null;
      }),
    ],
    [queryEditorExtensions],
  );
  const logsQueryExplanation = useQueryExplanation(effectiveQuery);

  // Cmd/Ctrl+[ toggles the search panel collapse
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest("input, textarea, select, [contenteditable='true'], .cm-editor") ||
          target.getAttribute("role") === "textbox" ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "[" && !e.repeat) {
        e.preventDefault();
        setLogsSearchCollapsed(!useSearchPanelUIStore.getState().logsSearchCollapsed);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setLogsSearchCollapsed]);

  const activeProfileId = useConnectionStore((s) => s.activeProfileId);
  const fieldValueQueries = useQueries({
    queries: SIDEBAR_FIELDS.map((field) => ({
      queryKey: ["field-values", activeProfileId, connection?.url, indexPattern, field] as const,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const client = new ElasticsearchClient(connection!);
        return getFieldValues(client, indexPattern, field, 8, signal);
      },
      enabled: Boolean(connection),
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
  });

  const fieldValues = useMemo<Record<string, Array<{ value: string; count: number }>>>(() => {
    const entries: Array<[string, Array<{ value: string; count: number }>]> = [];
    for (const [index, query] of fieldValueQueries.entries()) {
      if (!query.data) continue;
      const field = SIDEBAR_FIELDS[index];
      if (!field) continue;
      entries.push([field, query.data]);
    }
    return Object.fromEntries(entries);
  }, [fieldValueQueries]);

  const fieldValuesLoading = fieldValueQueries.some((q) => q.isFetching);
  const fieldValuesError = fieldValueQueries.every((q) => q.isError)
    ? fieldValueQueries.find((q) => q.error)?.error
    : null;
  const fieldValuesErrorMessage = fieldValuesError
    ? fieldValuesError instanceof Error
      ? fieldValuesError.message
      : String(fieldValuesError)
    : null;

  const handleCellFilter = useCallback(
    (field: string, value: string, exclude = false) => {
      // ES|QL table cells can render missing values as the literal "null" string.
      if (!value || value === "null") return;
      addFilter({ field, value, exclude });
    },
    [addFilter],
  );

  const handleTracePivot = useCallback(
    (traceId: string) => {
      const trimmed = traceId.trim();
      if (!trimmed) return;
      const safeTraceId = escapeEsqlString(trimmed);
      openInDiscover(
        `FROM traces-* | WHERE trace.id == "${safeTraceId}" | SORT @timestamp DESC | LIMIT 200`,
      );
    },
    [openInDiscover],
  );

  const {
    handleAnomalyDrillIn,
    handleApplyExtraction,
    handleOpenExtractBuilder,
    runCategorizeQuery,
    runChangePointExperience,
    runErrorTriageExperience,
    runGuidedGenericMatch,
    runServicePivotExperience,
    runTraceCorrelationExperience,
  } = useLogsQueryExperiences({
    effectiveQuery,
    runQuery,
    setRawQuery,
    setViewMode,
    setSearchText,
    histogramIntervalMinutes: HISTOGRAM_INTERVAL_MINUTES,
    extractMethod,
    extractPattern,
    result,
    setExtractedSidebarFields,
    setExtractDialogOpen,
    setExtractSource,
    setExtractMethod,
    setExtractPattern,
  });

  const slotContext = useMemo(
    () =>
      JSON.stringify({
        indexPattern,
        searchText,
        filterCount: filters.length,
        effectiveQuery,
        rowCount: result?.values.length ?? 0,
        columns: result?.columns.map((c) => c.name) ?? [],
        viewMode,
        patternGroupCount: patternGroups.length,
        anomalyBucketCount: histogramBuckets.filter((b) => b.anomaly).length,
      }),
    [
      indexPattern,
      searchText,
      filters.length,
      effectiveQuery,
      result,
      viewMode,
      patternGroups.length,
      histogramBuckets,
    ],
  );

  const slotInsights = usePageSlotInsights({
    context: slotContext,
    systemPrompt: LOGS_SYSTEM_PROMPT,
    cacheKey: `logs-slots::${slotContext}`,
    slots: LOGS_INSIGHT_SLOTS,
    enabled: Boolean(result && !loading && !error),
  });

  return {
    // Store-level state
    connection,
    themeMode,
    logsSearchCollapsed,
    setLogsSearchCollapsed,
    searchText,
    setSearchText,
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    rawQuery,
    setRawQuery,
    result,
    // Local state
    setQueryContextView,
    fieldValues,
    fieldValuesError: fieldValuesErrorMessage,
    fieldValuesLoading,
    viewMode,
    setViewMode,
    extractDialogOpen,
    setExtractDialogOpen,
    extractMethod,
    setExtractMethod,
    extractPattern,
    setExtractPattern,
    extractSource,
    setExtractSource,
    logsQueryEditorCollapsed,
    setLogsQueryEditorCollapsed,
    logsEditorFocused,
    logsExplainOpen,
    setLogsExplainOpen,
    logsExplainPanelId,
    // Derived
    effectiveQuery,
    sidebarFields,
    extractedFieldValues,
    histogramBuckets,
    patternGroups,
    logsQueryEditorExtensions,
    queryEditorExtensions,
    logsQueryExplanation,
    // Query state
    loading,
    error,
    runLogsQuery,
    // Handlers
    handleCellFilter,
    handleTracePivot,
    handleAnomalyDrillIn,
    handleApplyExtraction,
    handleOpenExtractBuilder,
    runCategorizeQuery,
    runChangePointExperience,
    runErrorTriageExperience,
    runGuidedGenericMatch,
    runServicePivotExperience,
    runTraceCorrelationExperience,
    // Insight slots
    slotInsights,
  };
}
