import { useState, useCallback, useDeferredValue, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import AddIcon from "@mui/icons-material/Add";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import TableChartIcon from "@mui/icons-material/TableChart";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
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
import QueryPipelineSteps from "./QueryPipelineSteps";
import QueryProfilePanel from "./QueryProfilePanel";
import PartialResultPanel from "./PartialResultPanel";
import EmptyState from "./EmptyState";
import FieldPickerSidebar from "./FieldPickerSidebar";
import PageHeader from "./PageHeader";
import DataTable from "./visualizations/DataTable";
import type { SortState } from "./visualizations/DataTable";
import { createEsqlQueryEditorExtensions } from "./queryEditorExtensions";
import ResizableEditorContainer from "./ResizableEditorContainer";
import QueryAnnotationOverlay from "./QueryAnnotationOverlay";

interface DiscoverPageProps {
  mode?: "query-lab" | "logs";
}

export default function DiscoverPage({ mode = "query-lab" }: DiscoverPageProps) {
  const isLogsExplorer = mode === "logs";
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
      // By default select all fields
      setSelectedFields(new Set(data.columns.map((c) => c.name)));
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
      if (cached?.data && !cached.loading) return;
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
      // Best-effort: replace cross-cluster wildcard `*:pattern` in FROM with
      // specific healthy cluster names so the query targets only healthy data.
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
  const queryEditorExtensions = useMemo(
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
      title: "Query Lab Panel",
      query: effectiveQuery.trim(),
      visualization: "table" as const,
      layout: { x: 0, y: Infinity, w: 12, h: 5 },
    };
    addPanel(newPanel);
    setEditingPanelId(newPanel.id);
    navigate(`/dashboards/${activeDashboardId}`);
  }, [effectiveQuery, addPanel, setEditingPanelId, navigate, activeDashboardId]);
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title={isLogsExplorer ? "Logs Explorer Query" : "ES|QL Query"}
          actions={
            <>
              <Button
                variant="text"
                size="small"
                onClick={(e) => setHistoryAnchor(e.currentTarget)}
                disabled={queryHistory.length === 0}
              >
                Recent queries
              </Button>
              <Menu
                anchorEl={historyAnchor}
                open={Boolean(historyAnchor)}
                onClose={() => setHistoryAnchor(null)}
              >
                {queryHistory.map((historyQuery, idx) => (
                  <MenuItem
                    key={`${historyQuery}-${idx}`}
                    onClick={() => handleSelectHistory(historyQuery)}
                  >
                    {historyQuery}
                  </MenuItem>
                ))}
              </Menu>
              <Typography
                component="a"
                href="https://www.elastic.co/guide/en/elasticsearch/reference/current/esql.html"
                target="_blank"
                rel="noreferrer"
                variant="caption"
                color="primary.main"
                sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                ES|QL documentation
              </Typography>
            </>
          }
        />
        <Box
          sx={{
            overflow: "hidden",
            mb: 1,
            boxShadow: editorFocused
              ? (theme) => `0 0 0 1px ${theme.palette.primary.main}`
              : "none",
            border: 1,
            borderColor: editorFocused ? "primary.main" : "divider",
            borderRadius: 1,
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        >
          <ResizableEditorContainer
            height={discoverEditorHeight}
            onHeightChange={setDiscoverEditorHeight}
          >
            <Box sx={{ position: "relative", height: "100%" }}>
              <CodeMirror
                value={effectiveQuery}
                onChange={handleQueryChange}
                onCreateEditor={handleCreateEditor}
                extensions={queryEditorExtensions}
                theme={themeMode}
                height={`${discoverEditorHeight}px`}
                basicSetup={basicSetup}
                aria-label="ES|QL query editor"
              />
              <QueryAnnotationOverlay
                query={effectiveQuery}
                editorFocused={editorFocused}
                height={discoverEditorHeight}
              />
            </Box>
          </ResizableEditorContainer>
        </Box>
        <QueryPipelineSteps
          query={effectiveQuery}
          loading={loading}
          activeStep={activeStep}
          stepDurationsMs={stepDurationsMs}
          onRunStep={handleRunStep}
        />
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleRunQuery}
            disabled={loading || !effectiveQuery.trim()}
          >
            Run Query (Ctrl/Cmd+Enter)
          </Button>
          <Tooltip title="Send profile: true with the query to see operator-level execution timings">
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={profileMode}
                  onChange={(e) => setProfileMode(e.target.checked)}
                />
              }
              label={<Typography variant="caption">Profile query</Typography>}
              sx={{ ml: 0.5 }}
            />
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Format query: uppercase keywords and normalize whitespace">
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AutoFixHighIcon />}
                onClick={handleFormatQuery}
                disabled={!effectiveQuery.trim()}
              >
                Format
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Create a dashboard panel from this query">
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleCreatePanel}
                disabled={!effectiveQuery.trim()}
              >
                Convert to Visualization
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {result && lastRunDurationMs !== null && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <Chip size="small" label={`took ${lastRunDurationMs} ms`} />
        </Box>
      )}
      {result && lastRunIsPartial && lastRunPartialMetadata !== null && (
        <PartialResultPanel
          metadata={lastRunPartialMetadata}
          onRerunHealthyClusters={handleRerunHealthyClusters}
        />
      )}
      {lastRunProfile !== null && <QueryProfilePanel profile={lastRunProfile} />}

      {/* Content area: field picker + table */}
      <Box
        sx={{
          display: "flex",
          flex: 1,
          flexDirection: { md: "row", xs: "column" },
          gap: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <FieldPickerSidebar
          columns={columns}
          selectedFields={selectedFields}
          onToggleField={toggleField}
          fieldFilter={fieldFilter}
          onFieldFilterChange={setFieldFilter}
          onSelectVisible={selectVisibleFields}
          onDeselectVisible={deselectVisibleFields}
          visibleColumns={visibleColumns}
          expandedInsight={expandedInsight}
          insightsCache={insightsCache}
          onToggleInsight={handleToggleInsight}
        />

        {/* Results table */}
        <Paper variant="outlined" sx={{ flex: 1, overflow: "auto" }}>
          {!result && !loading && (
            <EmptyState
              icon={<TableChartIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
              heading="No results yet"
              description={
                isLogsExplorer
                  ? "Write or refine a logs ES|QL query above and press Ctrl/Cmd+Enter to run it."
                  : "Write an ES|QL query above and press Ctrl/Cmd+Enter to run it."
              }
              addDataHref="/add-data"
              action={
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleRunQuery}
                  disabled={!effectiveQuery.trim()}
                >
                  Run starter query
                </Button>
              }
            />
          )}
          {loading && !result && (
            <Box sx={{ p: 2 }}>
              <Skeleton variant="rectangular" height={36} sx={{ mb: 1, borderRadius: 1 }} />
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} variant="text" height={28} sx={{ mb: 0.5 }} />
              ))}
            </Box>
          )}
          {filteredResult && filteredResult.columns.length > 0 && (
            <DataTable
              key={tableVersion}
              data={filteredResult}
              onExportCsv={handleExportCsv}
              onRemoveColumn={toggleField}
              currentSort={currentSort}
              onSortChange={handleSortChange}
            />
          )}
          {filteredResult && filteredResult.columns.length === 0 && result && (
            <EmptyState
              icon={<TableChartIcon sx={{ mb: 0.5, color: "text.secondary", fontSize: 48 }} />}
              heading="No fields selected"
              description="Check the field picker to show columns."
            />
          )}
        </Paper>
      </Box>
    </Box>
  );
}
