import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";

import { ElasticsearchClient, getFieldValues } from "../../services/es";
import { useConnectionStore } from "../../store/useConnectionStore";
import { useUIStore } from "../../store/useUIStore";
import { useLogsStore } from "../../store/useLogsStore";
import { useQueryStore } from "../../store/useQueryStore";
import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { createEsqlQueryEditorExtensions } from "../queryEditorExtensions";
import DataTable from "../visualizations/DataTable";
import QueryAnnotationOverlay from "../QueryAnnotationOverlay";
import EmptyState from "../EmptyState";
import PageHeader from "../PageHeader";
import { PAGE_MANIFEST } from "../../routes/manifest";

import { buildLogsQuery } from "./logsQueryBuilder";

const SIDEBAR_FIELDS = ["service.name", "log.level", "host.name", "event.dataset"];
const TRACE_ID_FIELD = "trace.id";

export default function LogsPage() {
  const navigate = useNavigate();
  const connection = useConnectionStore((s) => s.connection);
  const themeMode = useUIStore((s) => s.themeMode);
  const setDiscoverQueryDraft = useQueryStore((s) => s.setDiscoverQueryDraft);
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
  const [editorFocused, setEditorFocused] = useState(false);
  const [fieldValues, setFieldValues] = useState<
    Record<string, Array<{ value: string; count: number }>>
  >({});
  const [fieldValuesError, setFieldValuesError] = useState<string | null>(null);
  const [fieldValuesLoading, setFieldValuesLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(searchText);
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

  useEffect(() => {
    if (rawQuery !== null) setRawQuery(null);
  }, [generatedQuery, rawQuery, setRawQuery]);

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
      EditorView.lineWrapping,
      ...createEsqlQueryEditorExtensions(() => handleRunQueryRef.current()),
      EditorView.focusChangeEffect.of((_state, focusing) => {
        setEditorFocused(focusing);
        return null;
      }),
    ],
    [],
  );

  useEffect(() => {
    if (!connection) return;
    const client = new ElasticsearchClient(connection);
    const controller = new AbortController();
    let mounted = true;
    const loadValues = async () => {
      setFieldValuesLoading(true);
      setFieldValuesError(null);
      try {
        const entries = await Promise.all(
          SIDEBAR_FIELDS.map(async (field) => [
            field,
            await getFieldValues(client, indexPattern, field, 8, controller.signal),
          ]),
        );
        if (!mounted) return;
        setFieldValues(Object.fromEntries(entries));
      } catch (e) {
        if (!mounted) return;
        setFieldValuesError(String(e));
      } finally {
        if (mounted) {
          setFieldValuesLoading(false);
        }
      }
    };
    void loadValues();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [connection, indexPattern, filters]);

  const handleCellFilter = useCallback(
    (field: string, value: string, exclude = false) => {
      if (!value || value === "null") return;
      addFilter({ field, value, exclude });
    },
    [addFilter],
  );

  const handleTracePivot = useCallback(
    (traceId: string) => {
      const safeTraceId = traceId.trim();
      if (!safeTraceId) return;
      setDiscoverQueryDraft(
        `FROM traces-* | WHERE trace.id == "${safeTraceId.replaceAll('"', '\\"')}" | SORT @timestamp DESC | LIMIT 200`,
      );
      navigate(PAGE_MANIFEST.discover.path);
    },
    [navigate, setDiscoverQueryDraft],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader title="Logs Explorer" />
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 1 }}>
          <TextField
            size="small"
            fullWidth
            label="Search logs"
            placeholder='Use quotes for phrase match, e.g. "connection reset by peer"'
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearchText(searchInput);
              }
            }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => setSearchText(searchInput)}
            sx={{ minWidth: 112 }}
          >
            Apply Search
          </Button>
          <Button size="small" variant="text" onClick={() => clearFilters()}>
            Clear Filters
          </Button>
        </Stack>

        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
          {filters.map((filter, index) => (
            <Chip
              key={`${filter.field}-${filter.value}-${String(filter.exclude)}-${index}`}
              size="small"
              color={filter.exclude ? "warning" : "default"}
              label={`${filter.exclude ? "NOT " : ""}${filter.field}: ${filter.value}`}
              onDelete={() => removeFilter(index)}
            />
          ))}
        </Stack>

        <Box sx={{ mb: 1, border: 1, borderColor: "divider", borderRadius: 1 }}>
          <Box sx={{ position: "relative", minHeight: editorFocused ? 132 : 52 }}>
            <CodeMirror
              value={effectiveQuery}
              onChange={(value) => setRawQuery(value)}
              onCreateEditor={(view) => setQueryContextView(view)}
              extensions={queryEditorExtensions}
              theme={themeMode}
              height={editorFocused ? "132px" : "52px"}
              basicSetup={{ lineNumbers: true, foldGutter: false, indentOnInput: false }}
              aria-label="ES|QL query editor"
            />
            <QueryAnnotationOverlay
              query={effectiveQuery}
              editorFocused={editorFocused}
              height={editorFocused ? 132 : 52}
            />
          </Box>
        </Box>

        <Button
          variant="contained"
          size="small"
          startIcon={<PlayArrowIcon />}
          onClick={runLogsQuery}
          disabled={loading || !effectiveQuery.trim()}
        >
          {loading ? "Searching..." : "Search Logs"}
        </Button>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: "flex", flex: 1, gap: 1, minHeight: 0 }}>
        <Paper
          variant="outlined"
          sx={{
            display: { lg: "block", xs: "none" },
            flexShrink: 0,
            width: 280,
            overflow: "hidden",
          }}
        >
          <Box sx={{ p: 1 }}>
            <Typography variant="subtitle1">Field Filters</Typography>
            <Typography variant="caption" color="text.secondary">
              Click + to include or - to exclude
            </Typography>
          </Box>
          <Divider />
          {fieldValuesLoading && <LinearProgress />}
          {fieldValuesError && (
            <Typography variant="caption" color="error" sx={{ display: "block", p: 1.5 }}>
              Failed to load field values.
            </Typography>
          )}
          {!fieldValuesLoading && !fieldValuesError && (
            <List dense disablePadding>
              {SIDEBAR_FIELDS.map((field) => (
                <Box key={field}>
                  <ListItem sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={<Typography variant="caption">{field}</Typography>}
                      primaryTypographyProps={{ component: "div" }}
                    />
                  </ListItem>
                  {(fieldValues[field] ?? []).map((entry) => (
                    <ListItem key={`${field}-${entry.value}`} disablePadding>
                      <ListItemButton sx={{ pl: 2, py: 0.5 }}>
                        <ListItemText
                          primary={
                            <Typography variant="caption" noWrap title={entry.value}>
                              {entry.value}
                            </Typography>
                          }
                          secondary={`${entry.count.toLocaleString()} docs`}
                        />
                        <Stack direction="row" spacing={0.5}>
                          <Button
                            size="small"
                            variant="text"
                            aria-label={`Include ${field} ${entry.value}`}
                            onClick={() => handleCellFilter(field, entry.value, false)}
                          >
                            <AddIcon fontSize="inherit" />
                          </Button>
                          <Button
                            size="small"
                            variant="text"
                            aria-label={`Exclude ${field} ${entry.value}`}
                            onClick={() => handleCellFilter(field, entry.value, true)}
                          >
                            <RemoveIcon fontSize="inherit" />
                          </Button>
                        </Stack>
                      </ListItemButton>
                    </ListItem>
                  ))}
                  <Divider />
                </Box>
              ))}
            </List>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, overflow: "auto" }}>
          {!result && !loading && (
            <EmptyState
              heading="No logs loaded"
              description="Run the current query to explore logs and click values to add filters."
            />
          )}
          {result && (
            <>
              <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary">
                  {result.values.length.toLocaleString()} rows returned — click a cell to add a
                  filter
                </Typography>
              </Box>
              <DataTable
                data={result}
                onCellClick={({ columnName, value }) => {
                  if (columnName === TRACE_ID_FIELD) {
                    handleTracePivot(value);
                    return;
                  }
                  handleCellFilter(columnName, value, false);
                }}
              />
              {result.columns.some((col) => col.name === TRACE_ID_FIELD) && (
                <Box sx={{ display: "flex", gap: 1, p: 1, borderTop: 1, borderColor: "divider" }}>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<OpenInNewIcon />}
                    onClick={() => {
                      const traceColIdx = result.columns.findIndex(
                        (c) => c.name === TRACE_ID_FIELD,
                      );
                      const traceValue = traceColIdx >= 0 ? result.values[0]?.[traceColIdx] : null;
                      if (traceValue != null) {
                        handleTracePivot(String(traceValue));
                      }
                    }}
                  >
                    Open first trace in Query Lab
                  </Button>
                </Box>
              )}
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
