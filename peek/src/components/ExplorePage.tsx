import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import CodeIcon from "@mui/icons-material/Code";
import SaveIcon from "@mui/icons-material/Save";
import SearchIcon from "@mui/icons-material/Search";
import { useShallow } from "zustand/react/shallow";
import { parseAsString, useQueryState, useQueryStates } from "nuqs";
import { EditorView } from "@codemirror/view";

import { useDashboardCatalogStore } from "../store/useDashboardCatalogStore";
import { useDashboardEditorStore } from "../store/useDashboardEditorStore";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { useQueryStore } from "../store/useQueryStore";
import { PAGE_MANIFEST } from "../routes/manifest";
import { useExplorerStore } from "../store/useExplorerStore";
import { ElasticsearchClient } from "../services/es";
import type { FieldInfo, ExplorerFilter } from "../services/es";
import type { EsqlResponse } from "../types";
import { useExploreFields } from "../hooks/useExploreFields";
import { useExploreQuery } from "../hooks/useExploreQuery";
import { INSIGHT_GUARDRAIL } from "../hooks/insightPromptUtils";

import { createEsqlQueryEditorExtensions } from "./queryEditorExtensions";
import MetricsSearchPanel from "./explore/MetricsSearchPanel";
import ExploreContentArea from "./explore/ExploreContentArea";
import PageInsightBanner from "./PageInsightBanner";
import { useExplorerUrlSync } from "./explore/useExplorerUrlSync";
import {
  explorerSearchParsers,
  exploreSearchUrlKeys,
  metricNamespaceOf,
} from "./explore/exploreUtils";

export default function ExplorePage() {
  const navigate = useNavigate();
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [showEsql, setShowEsql] = useState(false);
  const { dashboard, addPanel, setTimeRange } = useDashboardEditorStore(
    useShallow((s) => ({
      dashboard: s.dashboard,
      addPanel: s.addPanel,
      setTimeRange: s.setTimeRange,
    })),
  );
  const activeDashboardId = useDashboardCatalogStore((s) => s.activeDashboardId);
  const connection = useConnectionStore((s) => s.connection);
  const themeMode = useUIStore((s) => s.themeMode);
  const metricsSearchCollapsed = useUIStore((s) => s.metricsSearchCollapsed);
  const setMetricsSearchCollapsed = useUIStore((s) => s.setMetricsSearchCollapsed);
  const setEditingPanelId = useUIStore((s) => s.setEditingPanelId);
  const setDiscoverQueryDraft = useQueryStore((s) => s.setDiscoverQueryDraft);

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
    // When rawQuery is null, React Query handles execution automatically.
    // When rawQuery is set, we trigger React Query to refetch by using its key.
    // The queryOverride in useExploreQuery handles this — no manual execution needed.
    // However we can force a refetch by toggling rawQuery:
    if (rawQuery) {
      // Re-set the same rawQuery to trigger a React Query key change
      setRawQuery(rawQuery);
    }
  }, [rawQuery, setRawQuery]);

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

  const handleEditInDiscover = useCallback(() => {
    if (queryResult.esql) {
      setDiscoverQueryDraft(queryResult.esql);
      navigate(PAGE_MANIFEST.discover.path);
    }
  }, [queryResult.esql, setDiscoverQueryDraft, navigate]);

  const handleSaveToDashboard = useCallback(() => {
    if (!queryResult.esql) return;
    const newPanel = {
      id: crypto.randomUUID(),
      title: selectedMetric ?? "Metrics Panel",
      query: queryResult.esql,
      visualization: "timeseries" as const,
      layout: { x: 0, y: Infinity, w: 6, h: 4 },
    };
    addPanel(newPanel);
    setEditingPanelId(newPanel.id);
    navigate(`/dashboards/${activeDashboardId}`);
  }, [queryResult.esql, selectedMetric, addPanel, setEditingPanelId, navigate, activeDashboardId]);

  const chartData: EsqlResponse | null = useMemo(() => {
    if (queryResult.status !== "success" || !queryResult.data) return null;
    return queryResult.data as EsqlResponse;
  }, [queryResult]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%" }}>
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

      {/* Action buttons and ES|QL display — full detail mode only */}
      {selectedMetric && !showDimensionOverview && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Tooltip title="View generated ES|QL query">
            <IconButton
              size="small"
              aria-label="View generated ES|QL query"
              onClick={() => setShowEsql(!showEsql)}
              color={showEsql ? "primary" : "default"}
            >
              <CodeIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {queryResult.esql && (
            <>
              <Tooltip title="Edit this query in Query Lab">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SearchIcon />}
                  onClick={handleEditInDiscover}
                >
                  Edit in Query Lab
                </Button>
              </Tooltip>
              <Tooltip title="Save as dashboard panel">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveToDashboard}
                >
                  Save to Dashboard
                </Button>
              </Tooltip>
            </>
          )}

          <Box sx={{ flex: 1 }} />

          {queryResult.status === "success" && queryResult.executionTimeMs !== undefined && (
            <Typography variant="caption" color="text.secondary">
              Query took {queryResult.executionTimeMs}ms
            </Typography>
          )}
        </Box>
      )}
      <Collapse
        in={selectedMetric !== null && !showDimensionOverview && showEsql && !!queryResult.esql}
      >
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            bgcolor: "action.hover",
            wordBreak: "break-all",
            whiteSpace: "pre-wrap",
            fontSize: "0.8rem",
            fontFamily: "monospace",
          }}
        >
          {queryResult.esql}
        </Paper>
      </Collapse>

      {/* AI anomaly insight */}
      {selectedMetric && chartData && (
        <PageInsightBanner
          context={JSON.stringify({
            indexPattern,
            selectedMetric,
            aggregation,
            groupBy,
            filterCount: filters.length,
            rowCount: chartData.values.length,
            columns: chartData.columns.map((c) => c.name),
            sampleValues: chartData.values.slice(0, 10),
          })}
          systemPrompt={`You are a metrics anomaly detector for Elasticsearch. Analyze the current chart data and flag if latest values are significantly different from the mean (e.g. CPU > 90%, disk > 80%). Keep the response to one concise sentence.${INSIGHT_GUARDRAIL}`}
          cacheKey={`explore::${selectedMetric}::${aggregation}::${groupBy ?? ""}::${filters.length}::${JSON.stringify(chartData.values.slice(0, 10))}`}
        />
      )}

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
    </Box>
  );
}
