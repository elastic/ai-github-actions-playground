import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
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
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useShallow } from "zustand/react/shallow";

import { useDashboardStore } from "../store/useDashboardStore";
import { useConnectionStore } from "../store/useConnectionStore";
import { useUIStore } from "../store/useUIStore";
import { useQueryStore } from "../store/useQueryStore";
import { PAGE_MANIFEST } from "../routes/manifest";
import {
  useExplorerStore,
  serializeExplorerState,
  deserializeExplorerState,
} from "../store/useExplorerStore";
import {
  ElasticsearchClient,
  isElasticsearchError,
  listFields,
  buildExplorerQuery,
  getAggregationOptions,
} from "../services/es";
import type { AggregationType, FieldInfo, ExplorerFilter } from "../services/es";
import { buildTimeParams } from "../services/datemath";
import type { EsqlResponse } from "../types";

import MetricSearch from "./MetricSearch";
import MetricOverviewGrid from "./MetricOverviewGrid";
import DimensionOverviewGrid from "./DimensionOverviewGrid";
import DimensionSidebar from "./DimensionSidebar";
import TimeSeriesChart from "./visualizations/TimeSeriesChart";

function metricNamespaceOf(metricName: string): string {
  const dot = metricName.indexOf(".");
  if (dot > 0) return metricName.slice(0, dot);
  const underscore = metricName.indexOf("_");
  return underscore > 0 ? metricName.slice(0, underscore) : metricName;
}

export default function ExplorePage() {
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const { dashboard, addPanel, setTimeRange, activeDashboardId } = useDashboardStore(
    useShallow((s) => ({
      dashboard: s.dashboard,
      addPanel: s.addPanel,
      setTimeRange: s.setTimeRange,
      activeDashboardId: s.activeDashboardId,
    })),
  );
  const connection = useConnectionStore((s) => s.connection);
  const setEditingPanelId = useUIStore((s) => s.setEditingPanelId);
  const setDiscoverQueryDraft = useQueryStore((s) => s.setDiscoverQueryDraft);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearchRef = useRef(searchParams.toString());

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
    const restored = deserializeExplorerState(initialSearchRef.current);
    if (restored.indexPattern) {
      setIndexPattern(restored.indexPattern);
    }
    if (restored.metric) {
      setSelectedMetric(restored.metric);
      setSelectedNamespace(metricNamespaceOf(restored.metric));
    }
    if (restored.aggregation) {
      setAggregation(restored.aggregation);
    }
    if (restored.groupBy) {
      setGroupBy(restored.groupBy);
    }
    clearFilters();
    for (const filter of restored.filters) {
      addFilter(filter);
    }
    if (restored.from && restored.to) {
      setTimeRange({ from: restored.from, to: restored.to });
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
    const state = { indexPattern, selectedMetric, aggregation, filters, groupBy };
    const qs = serializeExplorerState(state, dashboard.timeRange);
    setSearchParams(qs, { replace: true });
  }, [
    indexPattern,
    selectedMetric,
    aggregation,
    filters,
    groupBy,
    dashboard.timeRange,
    setSearchParams,
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
          params.length > 0 ? { query: queryDef.esql, params } : { query: queryDef.esql },
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
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 1 }}>
      {/* Top controls */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" component="h1" color="text.secondary" sx={{ mb: 1 }}>
          Metrics
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
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
          <Box sx={{ display: "flex", gap: 0.5, mt: 1, flexWrap: "wrap", alignItems: "center" }}>
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
          <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, alignItems: "center" }}>
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
          <Box sx={{ display: "flex", gap: 1, mt: 1, alignItems: "center" }}>
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
              fontFamily: "monospace",
              fontSize: "0.8rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
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
      <Box sx={{ display: "flex", flex: 1, gap: 1, overflow: "hidden", minHeight: 0 }}>
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
            sx={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}
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
            sx={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}
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
            sx={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}
          >
            {/* Back button — goes to dimension overview */}
            {selectedMetric && selectedNamespace && (
              <Box sx={{ px: 1.5, pt: 1 }}>
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
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  gap: 1,
                }}
              >
                <SearchIcon sx={{ fontSize: 48, opacity: 0.3 }} />
                <Typography variant="body2" color="text.secondary">
                  Select a namespace to start exploring
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Pick a namespace to see an overview of all its metrics, or search for a specific
                  metric field
                </Typography>
              </Box>
            )}

            {queryResult.status === "loading" && (
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
