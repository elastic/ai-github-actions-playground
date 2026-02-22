import { useState, useCallback, useMemo, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import AddIcon from "@mui/icons-material/Add";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { useDashboardStore } from "../store/useDashboardStore";
import type { EsqlColumn, EsqlResponse } from "../types";
import { DEFAULT_REFRESH_INTERVAL } from "../types";
import { useEsqlQuery } from "../hooks/useEsqlQuery";
import { filterColumnsByName, filterEsqlResult, toCsv } from "./discoverUtils";
import QueryPipelineSteps from "./QueryPipelineSteps";
import DataTable from "./visualizations/DataTable";
import { runQueryShortcutExtension } from "./queryEditorExtensions";

function getTypeColor(type: string): "default" | "primary" | "secondary" | "success" | "warning" {
  if (type === "date" || type === "date_nanos") return "warning";
  if (
    type === "long" ||
    type === "integer" ||
    type === "double" ||
    type === "float" ||
    type === "short" ||
    type === "byte"
  )
    return "primary";
  if (type === "boolean") return "secondary";
  if (type === "keyword" || type === "text" || type === "ip" || type === "version")
    return "success";
  return "default";
}

export default function DiscoverPage() {
  const connection = useDashboardStore((s) => s.connection);
  const themeMode = useDashboardStore((s) => s.themeMode);
  const addPanel = useDashboardStore((s) => s.addPanel);
  const setCurrentPage = useDashboardStore((s) => s.setCurrentPage);
  const setEditingPanelId = useDashboardStore((s) => s.setEditingPanelId);
  const discoverQueryDraft = useDashboardStore((s) => s.discoverQueryDraft);
  const setDiscoverQueryDraft = useDashboardStore((s) => s.setDiscoverQueryDraft);
  const queryHistory = useDashboardStore((s) => s.queryHistory);
  const appendQueryToHistory = useDashboardStore((s) => s.appendQueryToHistory);
  const refreshInterval = useDashboardStore(
    (s) => s.dashboard.refreshInterval ?? DEFAULT_REFRESH_INTERVAL,
  );

  const [query, setQuery] = useState("FROM logs-* | SORT @timestamp | LIMIT 50");
  const [result, setResult] = useState<EsqlResponse | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [fieldFilter, setFieldFilter] = useState("");
  const [tableVersion, setTableVersion] = useState(0);
  const [historyAnchor, setHistoryAnchor] = useState<HTMLElement | null>(null);
  const effectiveQuery = discoverQueryDraft ?? query;

  const { runQuery, loading, error, activeStep, stepDurationsMs, clearTimings } = useEsqlQuery({
    connection,
    onSuccess: (data, executedQuery) => {
      setResult(data);
      // By default select all fields
      setSelectedFields(new Set(data.columns.map((c) => c.name)));
      setTableVersion((prev) => prev + 1);
      appendQueryToHistory(executedQuery);
    },
    onFailure: () => setResult(null),
  });

  const handleRunQuery = useCallback(() => runQuery(effectiveQuery), [runQuery, effectiveQuery]);
  const handleQueryChange = useCallback(
    (nextQuery: string) => {
      if (discoverQueryDraft) {
        setDiscoverQueryDraft(null);
      }
      clearTimings();
      setQuery(nextQuery);
    },
    [discoverQueryDraft, setDiscoverQueryDraft, clearTimings],
  );

  const handleRunStep = useCallback(
    (stepQuery: string, stepIndex: number) => runQuery(stepQuery, stepIndex),
    [runQuery],
  );
  const handleSelectHistory = useCallback(
    (selectedQuery: string) => {
      setDiscoverQueryDraft(null);
      clearTimings();
      setQuery(selectedQuery);
      setHistoryAnchor(null);
    },
    [setDiscoverQueryDraft, clearTimings],
  );
  const queryEditorExtensions = useMemo(
    () => [sql(), runQueryShortcutExtension(() => void handleRunQuery())],
    [handleRunQuery],
  );
  useEffect(() => {
    if (!connection || !refreshInterval || !effectiveQuery.trim()) return;
    const id = setInterval(() => {
      if (loading) return;
      handleRunQuery();
    }, refreshInterval * 1000);
    return () => clearInterval(id);
  }, [connection, refreshInterval, effectiveQuery, loading, handleRunQuery]);

  const toggleField = useCallback((name: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
    setTableVersion((prev) => prev + 1);
  }, []);

  const handleCreatePanel = useCallback(() => {
    const newPanel = {
      id: crypto.randomUUID(),
      title: "Discover Panel",
      query: effectiveQuery.trim(),
      visualization: "table" as const,
      layout: { x: 0, y: Infinity, w: 12, h: 5 },
    };
    addPanel(newPanel);
    setEditingPanelId(newPanel.id);
    setCurrentPage("dashboard");
  }, [effectiveQuery, addPanel, setEditingPanelId, setCurrentPage]);

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
    a.download = "discover-results.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [filteredResult]);

  const columns = useMemo<EsqlColumn[]>(() => result?.columns ?? [], [result]);
  const visibleColumns = useMemo(
    () => filterColumnsByName(columns, fieldFilter),
    [columns, fieldFilter],
  );

  const selectVisibleFields = useCallback(() => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      for (const col of visibleColumns) next.add(col.name);
      return next;
    });
    setTableVersion((prev) => prev + 1);
  }, [visibleColumns]);

  const deselectVisibleFields = useCallback(() => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      for (const col of visibleColumns) next.delete(col.name);
      return next;
    });
    setTableVersion((prev) => prev + 1);
  }, [visibleColumns]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 1 }}>
      {/* Query bar */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box
          sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            ES|QL Query
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
          </Box>
        </Box>
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden", mb: 1 }}>
          <CodeMirror
            value={effectiveQuery}
            onChange={handleQueryChange}
            extensions={queryEditorExtensions}
            theme={themeMode}
            height="100px"
            basicSetup={{ lineNumbers: true, foldGutter: false }}
          />
        </Box>
        <QueryPipelineSteps
          query={effectiveQuery}
          loading={loading}
          activeStep={activeStep}
          stepDurationsMs={stepDurationsMs}
          onRunStep={handleRunStep}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleRunQuery}
            disabled={loading || !effectiveQuery.trim()}
          >
            Run Query (Ctrl/Cmd+Enter)
          </Button>
          <Box sx={{ flex: 1 }} />
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

      {/* Content area: field picker + table */}
      <Box sx={{ display: "flex", flex: 1, gap: 1, overflow: "hidden", minHeight: 0 }}>
        {/* Field picker sidebar */}
        <Paper
          variant="outlined"
          sx={{
            width: 220,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="subtitle2">Fields</Typography>
            {columns.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {selectedFields.size} / {columns.length} selected
              </Typography>
            )}
            {columns.length > 0 && (
              <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                <TextField
                  size="small"
                  placeholder="Filter fields"
                  value={fieldFilter}
                  onChange={(e) => setFieldFilter(e.target.value)}
                />
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  <Button size="small" onClick={selectVisibleFields}>
                    Select all
                  </Button>
                  <Button size="small" onClick={deselectVisibleFields}>
                    Deselect all
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
          <Box sx={{ flex: 1, overflow: "auto" }}>
            {columns.length === 0 ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ p: 1.5, display: "block" }}
              >
                Run a query to see fields
              </Typography>
            ) : (
              visibleColumns.map((col) => (
                <Box key={col.name}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      px: 0.5,
                      py: 0.25,
                      cursor: "pointer",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                    onClick={() => toggleField(col.name)}
                  >
                    <Checkbox
                      size="small"
                      checked={selectedFields.has(col.name)}
                      onChange={() => toggleField(col.name)}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ p: 0.5 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" noWrap display="block" title={col.name}>
                        {col.name}
                      </Typography>
                      <Chip
                        label={col.type}
                        size="small"
                        color={getTypeColor(col.type)}
                        sx={{ height: 14, fontSize: "0.6rem", "& .MuiChip-label": { px: 0.5 } }}
                      />
                    </Box>
                  </Box>
                  <Divider />
                </Box>
              ))
            )}
          </Box>
        </Paper>

        {/* Results table */}
        <Paper variant="outlined" sx={{ flex: 1, overflow: "auto" }}>
          {!result && !loading && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Run a query to see results
              </Typography>
            </Box>
          )}
          {loading && !result && (
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
          {filteredResult && filteredResult.columns.length > 0 && (
            <DataTable key={tableVersion} data={filteredResult} onExportCsv={handleExportCsv} />
          )}
          {filteredResult && filteredResult.columns.length === 0 && result && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                No fields selected — check the field picker to show columns
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
