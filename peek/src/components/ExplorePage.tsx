import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { useShallow } from "zustand/react/shallow";
import { parseAsString, useQueryState, useQueryStates } from "nuqs";
import { EditorView } from "@codemirror/view";

import { useDashboardEditorStore } from "../store/useDashboardEditorStore";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { useExplorerStore } from "../store/useExplorerStore";
import { ElasticsearchClient } from "../services/es";
import type { FieldInfo, ExplorerFilter } from "../services/es";
import type { EsqlResponse } from "../types";
import { useExploreFields } from "../hooks/useExploreFields";
import { useExploreQuery } from "../hooks/useExploreQuery";
import { INSIGHT_GUARDRAIL } from "../hooks/insightPromptUtils";
import { usePageSlotInsights } from "../hooks/usePageSlotInsights";

import { createEsqlQueryEditorExtensions } from "./queryEditorExtensions";
import { InsightSlotProvider } from "./InsightSlotContext";
import InsightSlot from "./InsightSlot";
import MetricsSearchPanel from "./explore/MetricsSearchPanel";
import ExploreContentArea from "./explore/ExploreContentArea";
import { useExplorerUrlSync } from "./explore/useExplorerUrlSync";
import {
  explorerSearchParsers,
  exploreSearchUrlKeys,
  metricNamespaceOf,
} from "./explore/exploreUtils";
import { EXPLORE_INSIGHT_SLOT_IDS, EXPLORE_INSIGHT_SLOTS } from "./explore/exploreInsightSlots";

const EXPLORE_SYSTEM_PROMPT =
  "You are a metrics observability assistant." +
  " Analyse the current metric exploration context and produce per-slot insights." +
  INSIGHT_GUARDRAIL;

export default function ExplorePage() {
  const queryClient = useQueryClient();
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const { dashboard, setTimeRange } = useDashboardEditorStore(
    useShallow((s) => ({
      dashboard: s.dashboard,
      setTimeRange: s.setTimeRange,
    })),
  );
  const connection = useConnectionStore((s) => s.connection);
  const themeMode = useUIStore((s) => s.themeMode);
  const metricsSearchCollapsed = useUIStore((s) => s.metricsSearchCollapsed);
  const setMetricsSearchCollapsed = useUIStore((s) => s.setMetricsSearchCollapsed);

  const location = useLocation();
  const [urlState, setUrlState] = useQueryStates(explorerSearchParsers, {
    urlKeys: exploreSearchUrlKeys,
    history: "replace",
  });
  const [urlFilters, setUrlFilters] = useQueryState(
    "filters",
    parseAsString.withOptions({ history: "replace" }),
  );
  const [initialSearch] = useState(() => location.search);
  const [initialUrlState] = useState(() => urlState);
  const [initialUrlFilters] = useState(() => urlFilters);

  const {
    indexPattern,
    selectedMetric,
    metricType,
    aggregation,
    filters,
    groupBy,
    rawQuery,
    setIndexPattern,
    setSelectedMetric,
    setAggregation,
    addFilter,
    removeFilter,
    clearFilters,
    setGroupBy,
    setRawQuery,
  } = useExplorerStore(
    useShallow((s) => ({
      indexPattern: s.indexPattern,
      selectedMetric: s.selectedMetric,
      metricType: s.metricType,
      aggregation: s.aggregation,
      filters: s.filters,
      groupBy: s.groupBy,
      rawQuery: s.rawQuery,
      setIndexPattern: s.setIndexPattern,
      setSelectedMetric: s.setSelectedMetric,
      setAggregation: s.setAggregation,
      addFilter: s.addFilter,
      removeFilter: s.removeFilter,
      clearFilters: s.clearFilters,
      setGroupBy: s.setGroupBy,
      setRawQuery: s.setRawQuery,
    })),
  );

  useExplorerUrlSync({
    initialSearch,
    initialUrlFilters: initialUrlFilters,
    initialUrlState,
    indexPattern,
    selectedMetric,
    aggregation,
    filters,
    groupBy,
    timeRange: dashboard.timeRange,
    setIndexPattern,
    setSelectedMetric,
    setSelectedNamespace,
    setAggregation,
    addFilter,
    clearFilters,
    setGroupBy,
    setTimeRange,
    setUrlState,
    setUrlFilters,
  });

  const { fields, fieldsLoading } = useExploreFields(indexPattern);
  const [, setQueryContextView] = useState<EditorView | null>(null);

  const client = useMemo(
    () => (connection ? new ElasticsearchClient(connection) : null),
    [connection],
  );

  const selectedMetricNamespace = useMemo(() => {
    if (!selectedMetric) return null;
    return metricNamespaceOf(selectedMetric);
  }, [selectedMetric]);
  const selectedMetricField = useMemo(
    () => fields.find((field) => field.name === selectedMetric) ?? null,
    [fields, selectedMetric],
  );

  const [skipDimensionOverview, setSkipDimensionOverview] = useState(false);

  // True when a metric is set (e.g. via URL) but does not exist in the loaded field list.
  const metricNotFound = selectedMetric !== null && !fieldsLoading && selectedMetricField === null;

  // Show namespace overview when a namespace is picked but no single metric is selected.
  const showOverview = selectedNamespace !== null && !selectedMetric;
  // Show dimension overview when a metric is selected but no groupBy is set yet.
  const showDimensionOverview =
    selectedMetric !== null && !groupBy && !skipDimensionOverview && !metricNotFound;

  // Reconcile metric type after field metadata loads (important for URL hydration paths).
  useEffect(() => {
    if (!selectedMetricField) return;
    const nextMetricType = selectedMetricField.metricType === "counter" ? "counter" : "gauge";
    if (nextMetricType !== metricType) {
      setSelectedMetric(selectedMetricField.name, nextMetricType);
    }
  }, [selectedMetricField, metricType, setSelectedMetric]);

  // Run query via React Query when metric/aggregation/filters/groupBy/timeRange change
  const queryResult = useExploreQuery({
    indexPattern,
    selectedMetric,
    metricType,
    aggregation,
    filters,
    groupBy,
    timeRange: dashboard.timeRange,
    enabled: Boolean(
      connection &&
      selectedMetric &&
      indexPattern &&
      !showDimensionOverview &&
      !metricNotFound &&
      !fieldsLoading,
    ),
    queryOverride: rawQuery,
  });

  const handleSearch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["explore-query", connection?.url] });
  }, [queryClient, connection?.url]);

  // Query editor extensions for the CodeMirror editor — ref keeps the
  // closure fresh without recreating the extension array on every render.
  const handleRunQueryRef = useRef<() => void>(() => undefined);
  // eslint-disable-next-line react-hooks/refs
  handleRunQueryRef.current = handleSearch;

  const queryEditorExtensions = useMemo(
    () => [
      EditorView.lineWrapping,
      // eslint-disable-next-line react-hooks/refs
      ...createEsqlQueryEditorExtensions(() => handleRunQueryRef.current()),
    ],
    [],
  );

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
        setMetricsSearchCollapsed(!useUIStore.getState().metricsSearchCollapsed);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setMetricsSearchCollapsed]);

  if (
    dismissedError !== null &&
    (queryResult.status === "loading" || queryResult.status === "success")
  ) {
    setDismissedError(null);
  }

  const handleMetricSelect = useCallback(
    (field: FieldInfo | null) => {
      if (field) {
        const mt = field.metricType === "counter" ? "counter" : "gauge";
        setSelectedMetric(field.name, mt);
        setSelectedNamespace(metricNamespaceOf(field.name));
        setGroupBy(null);
        setSkipDimensionOverview(false);
      } else {
        setSelectedMetric(null);
      }
    },
    [setSelectedMetric, setGroupBy],
  );

  const handleBackToOverview = useCallback(() => {
    setSelectedMetric(null);
    setGroupBy(null);
    setSkipDimensionOverview(false);
  }, [setSelectedMetric, setGroupBy]);

  const handleDimensionSelect = useCallback(
    (dimensionField: string) => {
      setGroupBy(dimensionField);
    },
    [setGroupBy],
  );

  const handleBackToDimensionOverview = useCallback(() => {
    setGroupBy(null);
    setSkipDimensionOverview(false);
  }, [setGroupBy]);

  const handleViewUngrouped = useCallback(() => {
    setSkipDimensionOverview(true);
  }, []);

  const handleAddFilter = useCallback(
    (filter: ExplorerFilter) => {
      addFilter(filter);
    },
    [addFilter],
  );

  const chartData: EsqlResponse | null = useMemo(() => {
    if (queryResult.status !== "success" || !queryResult.data) return null;
    return queryResult.data as EsqlResponse;
  }, [queryResult]);

  const slotContext = useMemo(
    () =>
      JSON.stringify({
        indexPattern,
        selectedMetric,
        aggregation,
        groupBy,
        filterCount: filters.length,
        rowCount: chartData?.values.length ?? 0,
        columns: chartData?.columns.map((c) => c.name) ?? [],
        sampleValues: chartData?.values.slice(0, 10) ?? [],
      }),
    [indexPattern, selectedMetric, aggregation, groupBy, filters.length, chartData],
  );

  const slotInsights = usePageSlotInsights({
    context: slotContext,
    systemPrompt: EXPLORE_SYSTEM_PROMPT,
    cacheKey: `explore-slots::${slotContext}`,
    slots: EXPLORE_INSIGHT_SLOTS,
    enabled: Boolean(selectedMetric && chartData),
  });

  return (
    <InsightSlotProvider
      summary={slotInsights.summary}
      insights={slotInsights.insights}
      loading={slotInsights.loading}
      error={slotInsights.error}
      refresh={slotInsights.refresh}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%" }}>
        <InsightSlot slotId={EXPLORE_INSIGHT_SLOT_IDS.exploreSearch}>
          <MetricsSearchPanel
            indexPattern={indexPattern}
            fields={fields}
            fieldsLoading={fieldsLoading}
            selectedMetric={selectedMetric}
            selectedNamespace={selectedNamespace}
            metricType={metricType}
            aggregation={aggregation}
            filters={filters}
            groupBy={groupBy}
            rawQuery={rawQuery}
            timeRange={dashboard.timeRange}
            onIndexPatternChange={setIndexPattern}
            onNamespaceChange={(namespace) => {
              setSelectedNamespace(namespace);
              if (
                selectedMetric &&
                namespace &&
                !selectedMetric.startsWith(`${namespace}.`) &&
                selectedMetric !== namespace
              ) {
                setSelectedMetric(null);
              }
            }}
            onMetricSelect={handleMetricSelect}
            onAggregationChange={setAggregation}
            onRemoveFilter={removeFilter}
            onClearFilters={clearFilters}
            onGroupByDelete={() => setGroupBy(null)}
            onRawQueryChange={setRawQuery}
            onCreateEditor={setQueryContextView}
            queryEditorExtensions={queryEditorExtensions}
            themeMode={themeMode}
            searchLoading={queryResult.status === "loading"}
            onSearch={handleSearch}
            searchResultCount={chartData ? chartData.values.length : null}
            collapsed={metricsSearchCollapsed}
            onToggleCollapsed={() => setMetricsSearchCollapsed(!metricsSearchCollapsed)}
          />
        </InsightSlot>

        {/* Error display */}
        {queryResult.status === "error" &&
          queryResult.error &&
          queryResult.error !== dismissedError && (
            <Alert
              severity="error"
              action={
                <IconButton
                  size="small"
                  aria-label="Dismiss error"
                  onClick={() => setDismissedError(queryResult.error ?? null)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              }
            >
              {queryResult.error}
            </Alert>
          )}

        <InsightSlot slotId={EXPLORE_INSIGHT_SLOT_IDS.exploreContent}>
          <ExploreContentArea
            fields={fields}
            client={client}
            indexPattern={indexPattern}
            selectedMetric={selectedMetric}
            selectedMetricNamespace={selectedMetricNamespace}
            metricType={metricType}
            selectedNamespace={selectedNamespace}
            groupBy={groupBy}
            showOverview={showOverview}
            showDimensionOverview={showDimensionOverview}
            metricNotFound={metricNotFound}
            chartData={chartData}
            queryStatus={queryResult.status}
            timeRange={dashboard.timeRange}
            onMetricSelect={handleMetricSelect}
            onDimensionSelect={handleDimensionSelect}
            onBackToOverview={handleBackToOverview}
            onBackToDimensionOverview={handleBackToDimensionOverview}
            onViewUngrouped={handleViewUngrouped}
            onAddFilter={handleAddFilter}
            onSetGroupBy={setGroupBy}
          />
        </InsightSlot>
      </Box>
    </InsightSlotProvider>
  );
}
