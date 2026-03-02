import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import CodeIcon from "@mui/icons-material/Code";
import SearchIcon from "@mui/icons-material/Search";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useShallow } from "zustand/react/shallow";
import { parseAsString, parseAsStringEnum, useQueryState, useQueryStates } from "nuqs";

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
  getAggregationOptions,
  EXPLORER_AGGREGATIONS,
} from "../services/es";
import type { AggregationType, FieldInfo, ExplorerFilter } from "../services/es";
import { buildTimeParams } from "../services/datemath";
import type { EsqlResponse } from "../types";

import MetricSearch from "./MetricSearch";
import MetricOverviewGrid from "./MetricOverviewGrid";
import DimensionOverviewGrid from "./DimensionOverviewGrid";
import DimensionSidebar from "./DimensionSidebar";
import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";
import TimeSeriesChart from "./visualizations/TimeSeriesChart";

const VALID_FILTER_OPS = new Set<ExplorerFilter["op"]>(["==", "!=", "LIKE"]);
const parseAggregation = parseAsStringEnum<AggregationType>([...EXPLORER_AGGREGATIONS]);
const explorerSearchParsers = {
  indexPattern: parseAsString,
  selectedMetric: parseAsString,
  aggregation: parseAggregation,
  groupBy: parseAsString,
  from: parseAsString,
  to: parseAsString,
};
const exploreSearchUrlKeys = {
  indexPattern: "index",
  selectedMetric: "metric",
  aggregation: "agg",
};

function isExplorerFilterOp(value: string): value is ExplorerFilter["op"] {
  return VALID_FILTER_OPS.has(value as ExplorerFilter["op"]);
}

function parseLegacyFilters(search: string): ExplorerFilter[] {
  const params = new URLSearchParams(search);
  const parsedFilters: ExplorerFilter[] = [];
  for (const [key, value] of params.entries()) {
    if (!key.startsWith("filter.")) continue;
    const field = key.slice("filter.".length).trim();
    if (!field) continue;
    const colonIdx = value.indexOf(":");
    if (colonIdx <= 0) continue;
    const op = value.slice(0, colonIdx);
    if (!isExplorerFilterOp(op)) continue;
    parsedFilters.push({ field, op, value: value.slice(colonIdx + 1) });
  }
  return parsedFilters;
}

function parseEncodedFilters(encodedFilters: string | null): ExplorerFilter[] {
  if (!encodedFilters) return [];
  try {
    const parsed = JSON.parse(encodedFilters);
    if (!Array.isArray(parsed)) return [];
    const validFilters: ExplorerFilter[] = [];
    for (const filter of parsed) {
      if (
        typeof filter !== "object" ||
        filter === null ||
        typeof filter.field !== "string" ||
        typeof filter.op !== "string" ||
        typeof filter.value !== "string" ||
        !isExplorerFilterOp(filter.op)
      ) {
        continue;
      }
      const field = filter.field.trim();
      if (!field) continue;
      validFilters.push({ field, op: filter.op, value: filter.value });
    }
    return validFilters;
  } catch {
    return [];
  }
}

function encodeFilters(filters: ExplorerFilter[]): string | null {
  const validFilters: ExplorerFilter[] = [];
  for (const filter of filters) {
    const field = filter.field.trim();
    if (!field || !VALID_FILTER_OPS.has(filter.op)) continue;
    validFilters.push({ field, op: filter.op, value: filter.value });
  }
  return validFilters.length > 0 ? JSON.stringify(validFilters) : null;
}

function metricNamespaceOf(metricName: string): string {
  const dot = metricName.indexOf(".");
  if (dot > 0) return metricName.slice(0, dot);
  const underscore = metricName.indexOf("_");
  return underscore > 0 ? metricName.slice(0, underscore) : metricName;
}

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

  const abortRef = useRef<AbortController | null>(null);
  const hasHydratedFromUrlRef = useRef(false);
  const skipInitialUrlSyncRef = useRef(true);

  const client = useMemo(
    () => (connection ? new ElasticsearchClient(connection) : null),
    [connection],
  );

  const aggOptions = useMemo(() => getAggregationOptions(metricType), [metricType]);
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

  // Restore explorer state from URL on first mount.
  useEffect(() => {
    const initialUrlState = initialUrlStateRef.current;
    if (initialUrlState.indexPattern) {
      setIndexPattern(initialUrlState.indexPattern);
    }
    if (initialUrlState.selectedMetric) {
      setSelectedMetric(initialUrlState.selectedMetric);
      setSelectedNamespace(metricNamespaceOf(initialUrlState.selectedMetric));
    }
    if (initialUrlState.aggregation) {
      setAggregation(initialUrlState.aggregation);
    }
    if (initialUrlState.groupBy) {
      setGroupBy(initialUrlState.groupBy);
    }
    const initialEncodedFilters = parseEncodedFilters(initialUrlFiltersRef.current);
    const hydratedFilters =
      initialEncodedFilters.length > 0
        ? initialEncodedFilters
        : parseLegacyFilters(initialSearchRef.current);
    clearFilters();
    for (const filter of hydratedFilters) {
      addFilter(filter);
    }
    if (initialUrlState.from && initialUrlState.to) {
      setTimeRange({ from: initialUrlState.from, to: initialUrlState.to });
    }
    hasHydratedFromUrlRef.current = true;
  }, [
    addFilter,
    clearFilters,
    setAggregation,
    setGroupBy,
    setIndexPattern,
    setSelectedMetric,
    setTimeRange,
  ]);

  // Sync URL state
  useEffect(() => {
    if (!hasHydratedFromUrlRef.current) return;
    if (skipInitialUrlSyncRef.current) {
      skipInitialUrlSyncRef.current = false;
      return;
    }
    let cancelled = false;
    const syncUrlState = async () => {
      await Promise.all([
        setUrlState({
          indexPattern: indexPattern || null,
          selectedMetric: selectedMetric || null,
          aggregation,
          groupBy: groupBy || null,
          from: dashboard.timeRange.from,
          to: dashboard.timeRange.to,
        }),
        setUrlFilters(encodeFilters(filters)),
      ]);
      if (cancelled) return;
    };
    void syncUrlState();
    return () => {
      cancelled = true;
    };
  }, [
    indexPattern,
    selectedMetric,
    aggregation,
    filters,
    groupBy,
    dashboard.timeRange,
    setUrlState,
    setUrlFilters,
  ]);

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
        const params = buildTimeParams(queryDef.esql, dashboard.timeRange);
        const result = await client.query(
          Object.keys(params).length > 0
            ? { query: queryDef.esql, params }
            : { query: queryDef.esql },
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
      {/* Top controls */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ mb: 1 }}>
          <PageHeader title="Metrics" />
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "flex-start",
            "& .MuiInputBase-root": { height: 40 },
          }}
        >
          {/* Index pattern */}
          <TextField
            size="small"
            label="Index pattern"
            value={indexPattern}
            onChange={(e) => setIndexPattern(e.target.value)}
            sx={{ width: 200 }}
          />

          {/* Metric search */}
          <Box sx={{ flex: 1 }}>
            <MetricSearch
              fields={fields}
              loading={fieldsLoading}
              selectedMetric={selectedMetric}
              selectedNamespace={selectedNamespace}
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
              onSelect={handleMetricSelect}
            />
          </Box>

          {/* Aggregation selector — only in full detail mode */}
          {selectedMetric && !showDimensionOverview && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="explore-aggregation-label">Aggregation</InputLabel>
              <Select
                labelId="explore-aggregation-label"
                value={aggregation}
                label="Aggregation"
                onChange={(e) => setAggregation(e.target.value as AggregationType)}
              >
                {aggOptions.map((agg) => (
                  <MenuItem key={agg} value={agg}>
                    {agg.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>

        {/* Active filters — full detail mode only */}
        {selectedMetric && !showDimensionOverview && filters.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center", mt: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
              Filters:
            </Typography>
            {filters.map((f, i) => (
              <Chip
                key={`${f.field}-${f.op}-${f.value}-${i}`}
                label={`${f.field} ${f.op} "${f.value}"`}
                size="small"
                onDelete={() => removeFilter(i)}
                color="primary"
                variant="outlined"
              />
            ))}
            <Button size="small" onClick={clearFilters} sx={{ ml: 0.5 }}>
              Clear all
            </Button>
          </Box>
        )}

        {/* Group by indicator — full detail mode only */}
        {selectedMetric && !showDimensionOverview && groupBy && (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Split by:
            </Typography>
            <Chip
              label={groupBy}
              size="small"
              color="secondary"
              onDelete={() => setGroupBy(null)}
            />
          </Box>
        )}

        {/* Action buttons — full detail mode only */}
        {selectedMetric && !showDimensionOverview && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
            <Tooltip title="View generated ES|QL query">
              <IconButton
                size="small"
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

        {/* ES|QL display — full detail mode only */}
        <Collapse
          in={selectedMetric !== null && !showDimensionOverview && showEsql && !!queryResult.esql}
        >
          <Paper
            variant="outlined"
            sx={{
              mt: 1,
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
      </Paper>

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

      {/* Content area: dimension sidebar + chart / overview grids */}
      <Box sx={{ display: "flex", flex: 1, gap: 1, minHeight: 0, overflow: "hidden" }}>
        {/* Dimension sidebar — only show in full detail mode */}
        {selectedMetric && !showDimensionOverview && (
          <DimensionSidebar
            fields={fields}
            client={client}
            indexPattern={indexPattern}
            metricNamespace={selectedMetricNamespace}
            groupBy={groupBy}
            onAddFilter={handleAddFilter}
            onSetGroupBy={setGroupBy}
          />
        )}

        {/* Namespace overview grid */}
        {showOverview && (
          <Paper
            variant="outlined"
            sx={{ display: "flex", flex: 1, flexDirection: "column", overflow: "auto" }}
          >
            <MetricOverviewGrid
              fields={fields}
              namespace={selectedNamespace}
              indexPattern={indexPattern}
              timeRange={dashboard.timeRange}
              client={client}
              onSelectMetric={handleMetricSelect}
            />
          </Paper>
        )}

        {/* Dimension overview grid — metric selected, no groupBy yet */}
        {showDimensionOverview && (
          <Paper
            variant="outlined"
            sx={{ display: "flex", flex: 1, flexDirection: "column", overflow: "auto" }}
          >
            <DimensionOverviewGrid
              fields={fields}
              metricField={selectedMetric}
              metricType={metricType}
              metricNamespace={selectedMetricNamespace}
              indexPattern={indexPattern}
              timeRange={dashboard.timeRange}
              client={client}
              onSelectDimension={handleDimensionSelect}
              onBackToOverview={handleBackToOverview}
              onViewUngrouped={handleViewUngrouped}
            />
          </Paper>
        )}

        {/* Full detail chart area */}
        {!showOverview && !showDimensionOverview && (
          <Paper
            variant="outlined"
            sx={{ display: "flex", flex: 1, flexDirection: "column", overflow: "auto" }}
          >
            {/* Back button — goes to dimension overview */}
            {selectedMetric && selectedNamespace && (
              <Box sx={{ pt: 1, px: 1.5 }}>
                <Button
                  size="small"
                  startIcon={<ArrowBackIcon />}
                  onClick={handleBackToDimensionOverview}
                >
                  Back to dimensions
                </Button>
              </Box>
            )}

            {!selectedMetric && queryResult.status === "idle" && (
              <EmptyState
                icon={<ShowChartIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
                heading="Explore your metrics"
                description="Pick a namespace to see an overview of all its metrics, or search for a specific metric field."
              />
            )}

            {queryResult.status === "loading" && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <LinearProgress />
              </Box>
            )}

            {chartData && (
              <Box sx={{ flex: 1, minHeight: 300 }}>
                <TimeSeriesChart data={chartData} options={{ smooth: true, showArea: true }} />
              </Box>
            )}
          </Paper>
        )}
      </Box>
    </Box>
  );
}
