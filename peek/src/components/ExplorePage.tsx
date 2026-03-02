import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import { useShallow } from "zustand/react/shallow";
import { parseAsString, useQueryState, useQueryStates } from "nuqs";

import { useDashboardCatalogStore } from "../store/useDashboardCatalogStore";
import { useDashboardEditorStore } from "../store/useDashboardEditorStore";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { useQueryStore } from "../store/useQueryStore";
import { PAGE_MANIFEST } from "../routes/manifest";
import { useExplorerStore } from "../store/useExplorerStore";
import {
  ElasticsearchClient,
  isElasticsearchError,
  listFields,
  buildExplorerQuery,
} from "../services/es";
import type { FieldInfo, ExplorerFilter } from "../services/es";
import { resolveToPositionalParams } from "../services/datemath";
import type { EsqlResponse } from "../types";

import ExploreControlsPanel from "./explore/ExploreControlsPanel";
import ExploreContentArea from "./explore/ExploreContentArea";
import { useExplorerUrlSync } from "./explore/useExplorerUrlSync";
import {
  explorerSearchParsers,
  exploreSearchUrlKeys,
  metricNamespaceOf,
} from "./explore/exploreUtils";

export default function ExplorePage() {
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const { dashboard, addPanel, setTimeRange } = useDashboardEditorStore(
    useShallow((s) => ({
      dashboard: s.dashboard,
      addPanel: s.addPanel,
      setTimeRange: s.setTimeRange,
    })),
  );
  const activeDashboardId = useDashboardCatalogStore((s) => s.activeDashboardId);
  const connection = useConnectionStore((s) => s.connection);
  const setEditingPanelId = useUIStore((s) => s.setEditingPanelId);
  const setDiscoverQueryDraft = useQueryStore((s) => s.setDiscoverQueryDraft);

  const location = useLocation();
  const navigate = useNavigate();
  const [urlState, setUrlState] = useQueryStates(explorerSearchParsers, {
    urlKeys: exploreSearchUrlKeys,
    history: "replace",
  });
  const [urlFilters, setUrlFilters] = useQueryState(
    "filters",
    parseAsString.withOptions({ history: "replace" }),
  );
  const initialSearchRef = useRef(location.search);
  const initialUrlStateRef = useRef(urlState);
  const initialUrlFiltersRef = useRef(urlFilters);

  const {
    indexPattern,
    fields,
    fieldsLoading,
    selectedMetric,
    metricType,
    aggregation,
    filters,
    groupBy,
    queryResult,
    showEsql,
    setIndexPattern,
    setFields,
    setFieldsLoading,
    setSelectedMetric,
    setAggregation,
    addFilter,
    removeFilter,
    clearFilters,
    setGroupBy,
    setQueryResult,
    setShowEsql,
  } = useExplorerStore(
    useShallow((s) => ({
      indexPattern: s.indexPattern,
      fields: s.fields,
      fieldsLoading: s.fieldsLoading,
      selectedMetric: s.selectedMetric,
      metricType: s.metricType,
      aggregation: s.aggregation,
      filters: s.filters,
      groupBy: s.groupBy,
      queryResult: s.queryResult,
      showEsql: s.showEsql,
      setIndexPattern: s.setIndexPattern,
      setFields: s.setFields,
      setFieldsLoading: s.setFieldsLoading,
      setSelectedMetric: s.setSelectedMetric,
      setAggregation: s.setAggregation,
      addFilter: s.addFilter,
      removeFilter: s.removeFilter,
      clearFilters: s.clearFilters,
      setGroupBy: s.setGroupBy,
      setQueryResult: s.setQueryResult,
      setShowEsql: s.setShowEsql,
    })),
  );

  useExplorerUrlSync({
    initialSearch: initialSearchRef.current,
    initialUrlFilters: initialUrlFiltersRef.current,
    initialUrlState: initialUrlStateRef.current,
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

  const abortRef = useRef<AbortController | null>(null);

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

  // Show namespace overview when a namespace is picked but no single metric is selected.
  const showOverview = selectedNamespace !== null && !selectedMetric;
  // Show dimension overview when a metric is selected but no groupBy is set yet.
  const showDimensionOverview = selectedMetric !== null && !groupBy && !skipDimensionOverview;

  // Load fields when index pattern changes
  useEffect(() => {
    if (!client || !indexPattern) return;
    let cancelled = false;

    const loadFields = async () => {
      setFieldsLoading(true);
      try {
        const result = await listFields(client, indexPattern);
        if (!cancelled) setFields(result);
      } catch {
        if (!cancelled) setFields([]);
      } finally {
        if (!cancelled) setFieldsLoading(false);
      }
    };
    void loadFields();
    return () => {
      cancelled = true;
    };
  }, [client, indexPattern, setFields, setFieldsLoading]);

  // Reconcile metric type after field metadata loads (important for URL hydration paths).
  useEffect(() => {
    if (!selectedMetricField) return;
    const nextMetricType = selectedMetricField.metricType === "counter" ? "counter" : "gauge";
    if (nextMetricType !== metricType) {
      setSelectedMetric(selectedMetricField.name, nextMetricType);
    }
  }, [selectedMetricField, metricType, setSelectedMetric]);

  // Run query when metric/aggregation/filters/groupBy/timeRange change
  useEffect(() => {
    if (!client || !selectedMetric || !indexPattern || showDimensionOverview) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const run = async () => {
      const queryDef = buildExplorerQuery({
        indexPattern,
        metricField: selectedMetric,
        metricType,
        aggregation,
        filters,
        groupBy: groupBy ?? undefined,
        timeRange: dashboard.timeRange,
      });

      setQueryResult({ status: "loading", esql: queryDef.esql });

      try {
        const { query: resolvedQuery, params } = resolveToPositionalParams(
          queryDef.esql,
          dashboard.timeRange,
        );
        const result = await client.query(
          params.length > 0 ? { query: resolvedQuery, params } : { query: resolvedQuery },
          signal,
        );
        setQueryResult({
          status: "success",
          esql: queryDef.esql,
          data: result,
          executionTimeMs: result.executionTimeMs,
        });
      } catch (err) {
        if (signal.aborted) return;
        setQueryResult({
          status: "error",
          esql: queryDef.esql,
          error: isElasticsearchError(err) ? err.message : String(err),
        });
      }
    };
    void run();

    return () => {
      abortRef.current?.abort();
    };
  }, [
    client,
    indexPattern,
    selectedMetric,
    showDimensionOverview,
    metricType,
    aggregation,
    filters,
    groupBy,
    dashboard.timeRange,
    setQueryResult,
  ]);

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
    setQueryResult({ status: "idle" });
  }, [setSelectedMetric, setGroupBy, setQueryResult]);

  const handleDimensionSelect = useCallback(
    (dimensionField: string) => {
      setGroupBy(dimensionField);
    },
    [setGroupBy],
  );

  const handleBackToDimensionOverview = useCallback(() => {
    setGroupBy(null);
    setSkipDimensionOverview(false);
    setQueryResult({ status: "idle" });
  }, [setGroupBy, setQueryResult]);

  const handleViewUngrouped = useCallback(() => {
    setSkipDimensionOverview(true);
  }, []);

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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%" }}>
      <ExploreControlsPanel
        indexPattern={indexPattern}
        fields={fields}
        fieldsLoading={fieldsLoading}
        selectedMetric={selectedMetric}
        selectedNamespace={selectedNamespace}
        metricType={metricType}
        aggregation={aggregation}
        filters={filters}
        groupBy={groupBy}
        showEsql={showEsql}
        showDimensionOverview={showDimensionOverview}
        esql={queryResult.esql ?? null}
        queryStatus={queryResult.status}
        executionTimeMs={queryResult.status === "success" ? queryResult.executionTimeMs : undefined}
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
        onToggleEsql={() => setShowEsql(!showEsql)}
        onEditInDiscover={handleEditInDiscover}
        onSaveToDashboard={handleSaveToDashboard}
      />

      {/* Error display */}
      {queryResult.status === "error" && queryResult.error && (
        <Alert
          severity="error"
          action={
            <IconButton size="small" onClick={() => setQueryResult({ status: "idle" })}>
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
