import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import ListItemButton from "@mui/material/ListItemButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { EditorView } from "@codemirror/view";

import { ElasticsearchClient, getFieldValues } from "../../services/es";
import { useConnectionStore } from "../../store/useConnectionStore";
import { useUIStore } from "../../store/useUIStore";
import { useLogsStore } from "../../store/useLogsStore";
import { useQueryStore } from "../../store/useQueryStore";
import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { INSIGHT_GUARDRAIL } from "../../hooks/insightPromptUtils";
import { usePageSlotInsights } from "../../hooks/usePageSlotInsights";
import { createEsqlQueryEditorExtensions } from "../queryEditorExtensions";
import { InsightSlotProvider } from "../InsightSlotContext";
import InsightSlot from "../InsightSlot";
import DataTable from "../visualizations/DataTable";
import EmptyState from "../EmptyState";
import { PAGE_MANIFEST } from "../../routes/manifest";
import { escapeEsqlString } from "../../services/es/esqlUtils";

import LogsSearchPanel from "./LogsSearchPanel";
import { appendPipeClause, buildLogsQuery } from "./logsQueryBuilder";
import { LOGS_INSIGHT_SLOT_IDS, LOGS_INSIGHT_SLOTS } from "./logsInsightSlots";

const SIDEBAR_FIELDS = ["service.name", "log.level", "host.name", "event.dataset"];
const TRACE_ID_FIELD = "trace.id";
const MESSAGE_FIELD = "message";
const TIMESTAMP_FIELD = "@timestamp";
const HISTOGRAM_INTERVAL_MS = 5 * 60 * 1000;

type LogsViewMode = "lines" | "chart" | "patterns";
type ExtractMethod = "DISSECT" | "GROK";
interface HistogramBucket {
  start: number;
  end: number;
  count: number;
  anomaly: boolean;
}

function normalizePattern(message: string): string {
  return message
    .replace(/\b\d+\b/g, "{n}")
    .replace(/\b[0-9a-f]{8,}\b/gi, "{hex}")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "{ip}")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFieldNames(method: ExtractMethod, pattern: string): string[] {
  if (method === "DISSECT") {
    return Array.from(pattern.matchAll(/%\{([a-zA-Z0-9_.-]+)\}/g), (m) => m[1] ?? "").filter(
      Boolean,
    );
  }
  return Array.from(
    pattern.matchAll(/%\{[A-Z0-9_]+(?::([a-zA-Z0-9_.-]+)(?::[a-zA-Z0-9_]+)?)?\}/g),
    (m) => m[1] ?? "",
  ).filter(Boolean);
}

const LOGS_SYSTEM_PROMPT =
  "You are a log analysis assistant for Elasticsearch." +
  " Analyse the current log exploration context and produce per-slot insights." +
  INSIGHT_GUARDRAIL;

export default function LogsPage() {
  const navigate = useNavigate();
  const connection = useConnectionStore((s) => s.connection);
  const themeMode = useUIStore((s) => s.themeMode);
  const logsSearchCollapsed = useUIStore((s) => s.logsSearchCollapsed);
  const setLogsSearchCollapsed = useUIStore((s) => s.setLogsSearchCollapsed);
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
  const [fieldValues, setFieldValues] = useState<
    Record<string, Array<{ value: string; count: number }>>
  >({});
  const [extractedSidebarFields, setExtractedSidebarFields] = useState<string[]>([]);
  const [fieldValuesError, setFieldValuesError] = useState<string | null>(null);
  const [fieldValuesLoading, setFieldValuesLoading] = useState(false);
  const [viewMode, setViewMode] = useState<LogsViewMode>("lines");
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [extractMethod, setExtractMethod] = useState<ExtractMethod>("DISSECT");
  const [extractPattern, setExtractPattern] = useState("%{extracted.value}");
  const [extractSource, setExtractSource] = useState("");

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
    const out: Record<string, Array<{ value: string; count: number }>> = {};
    for (const field of extractedSidebarFields) {
      const colIdx = result.columns.findIndex((c) => c.name === field);
      if (colIdx < 0) continue;
      const counts = new Map<string, number>();
      for (const row of result.values) {
        const raw = row[colIdx];
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
    const timestampIndex = result.columns.findIndex((column) => column.name === TIMESTAMP_FIELD);
    if (timestampIndex < 0) return [];
    const bucketCounts = new Map<number, number>();
    for (const row of result.values) {
      const rawValue = row[timestampIndex];
      if (!rawValue) continue;
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
    const variance =
      counts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, counts.length);
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
    // CATEGORIZE query result shape: has "pattern" and "pattern_count" columns
    const patternColIndex = result.columns.findIndex((c) => c.name === "pattern");
    const countColIndex = result.columns.findIndex((c) => c.name === "pattern_count");
    if (patternColIndex >= 0 && countColIndex >= 0) {
      return result.values
        .map((row) => ({
          pattern: String(row[patternColIndex] ?? ""),
          sample: String(row[patternColIndex] ?? ""),
          count: Number(row[countColIndex] ?? 0),
        }))
        .filter((row) => row.pattern.length > 0)
        .sort((a, b) => b.count - a.count);
    }
    // Client-side grouping from raw message rows
    const messageIndex = result.columns.findIndex((column) => column.name === MESSAGE_FIELD);
    if (messageIndex < 0) return [];
    const groups = new Map<string, { pattern: string; sample: string; count: number }>();
    for (const row of result.values) {
      const raw = row[messageIndex];
      if (!raw) continue;
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
      EditorView.lineWrapping,
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
        setLogsSearchCollapsed(!useUIStore.getState().logsSearchCollapsed);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setLogsSearchCollapsed]);

  useEffect(() => {
    if (!connection) {
      setFieldValues({});
      setFieldValuesError(null);
      setFieldValuesLoading(false);
      return;
    }
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
      } catch (e: unknown) {
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
  }, [connection, indexPattern]);

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
      setDiscoverQueryDraft(
        `FROM traces-* | WHERE trace.id == "${safeTraceId}" | SORT @timestamp DESC | LIMIT 200`,
      );
      navigate(PAGE_MANIFEST.discover.path);
    },
    [navigate, setDiscoverQueryDraft],
  );

  const handleAnomalyDrillIn = useCallback(
    (start: number, end: number) => {
      const clause = [
        "STATS log_count = COUNT(*) BY bucket = BUCKET(@timestamp, 5 minutes)",
        "EVAL anomaly = CHANGE_POINT(log_count)",
        `WHERE anomaly IS NOT NULL AND bucket >= TO_DATETIME("${new Date(start).toISOString()}") AND bucket < TO_DATETIME("${new Date(end).toISOString()}")`,
      ].join(" | ");
      const nextQuery = appendPipeClause(effectiveQuery, clause);
      setRawQuery(nextQuery);
      void runQuery(nextQuery);
      setViewMode("chart");
    },
    [effectiveQuery, runQuery, setRawQuery],
  );

  const handleApplyExtraction = useCallback(() => {
    const trimmedPattern = extractPattern.trim();
    if (!trimmedPattern) return;
    const clause = `${extractMethod} ${MESSAGE_FIELD} "${escapeEsqlString(trimmedPattern)}"`;
    const nextQuery = appendPipeClause(effectiveQuery, clause);
    const extractedFields = extractFieldNames(extractMethod, trimmedPattern);
    if (extractedFields.length > 0) {
      setExtractedSidebarFields((prev) => Array.from(new Set([...prev, ...extractedFields])));
    }
    setRawQuery(nextQuery);
    void runQuery(nextQuery);
    setExtractDialogOpen(false);
  }, [effectiveQuery, extractMethod, extractPattern, runQuery, setRawQuery]);

  const runCategorizeQuery = useCallback(() => {
    const nextQuery = appendPipeClause(
      effectiveQuery,
      `STATS pattern_count = COUNT(*) BY pattern = CATEGORIZE(${MESSAGE_FIELD}) | SORT pattern_count DESC`,
    );
    setRawQuery(nextQuery);
    void runQuery(nextQuery);
    setViewMode("patterns");
  }, [effectiveQuery, runQuery, setRawQuery]);

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

  return (
    <InsightSlotProvider
      summary={slotInsights.summary}
      insights={slotInsights.insights}
      loading={slotInsights.loading}
      error={slotInsights.error}
      refresh={slotInsights.refresh}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: "100%" }}>
        <Box sx={{ width: "100%" }}>
          <InsightSlot slotId={LOGS_INSIGHT_SLOT_IDS.logsSearch}>
            <Box sx={{ width: "100%" }}>
              <LogsSearchPanel
                searchText={searchText}
                onSearchTextChange={setSearchText}
                filters={filters}
                onRemoveFilter={removeFilter}
                onClearFilters={clearFilters}
                effectiveQuery={effectiveQuery}
                onRawQueryChange={setRawQuery}
                onCreateEditor={setQueryContextView}
                queryEditorExtensions={queryEditorExtensions}
                themeMode={themeMode}
                searchLoading={loading}
                onSearch={runLogsQuery}
                searchResultCount={result ? result.values.length : null}
                collapsed={logsSearchCollapsed}
                onToggleCollapsed={() => setLogsSearchCollapsed(!logsSearchCollapsed)}
              />
            </Box>
          </InsightSlot>
        </Box>

        {/* View mode toggle */}
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <ToggleButtonGroup
            size="small"
            color="primary"
            value={viewMode}
            exclusive
            onChange={(_, next: LogsViewMode | null) => {
              if (next) setViewMode(next);
            }}
            aria-label="Logs view mode"
          >
            <ToggleButton value="lines">Lines</ToggleButton>
            <ToggleButton value="chart">Chart</ToggleButton>
            <ToggleButton value="patterns">Patterns</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ flex: 1, width: "100%", minHeight: 0 }}>
          <InsightSlot slotId={LOGS_INSIGHT_SLOT_IDS.logsResults}>
            <Box sx={{ display: "flex", flex: 1, gap: 1, width: "100%", minHeight: 0 }}>
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
                    {sidebarFields.map((field) => [
                      <ListSubheader
                        key={`${field}-header`}
                        disableSticky
                        sx={{ py: 0.5, lineHeight: "normal" }}
                      >
                        <Typography variant="caption">{field}</Typography>
                      </ListSubheader>,
                      ...(fieldValues[field] ?? extractedFieldValues[field] ?? []).map((entry) => (
                        <ListItem key={`${field}-${entry.value}`} disablePadding>
                          <Stack
                            direction="row"
                            spacing={0.5}
                            sx={{ alignItems: "center", width: "100%", pl: 2, py: 0.5 }}
                          >
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
                          </Stack>
                        </ListItem>
                      )),
                      <Divider key={`${field}-divider`} component="li" aria-hidden />,
                    ])}
                  </List>
                )}
              </Paper>

              <Paper
                variant="outlined"
                tabIndex={0}
                role="region"
                aria-label="Log results"
                sx={{ flex: 1, minWidth: 0, overflow: "auto" }}
              >
                <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
                  <Typography variant="caption" color="text.secondary">
                    {result
                      ? `${result.values.length.toLocaleString()} rows returned`
                      : "Run a query to populate results"}{" "}
                    — timeline and views share the visible ES|QL query above.
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      gap: 0.5,
                      alignItems: "end",
                      minHeight: 64,
                      overflowX: "auto",
                      mt: 1,
                    }}
                  >
                    {histogramBuckets.length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        No histogram buckets yet.
                      </Typography>
                    )}
                    {histogramBuckets.map((bucket) => (
                      <Button
                        key={bucket.start}
                        size="small"
                        variant={bucket.anomaly ? "contained" : "outlined"}
                        color={bucket.anomaly ? "warning" : "inherit"}
                        disabled={!bucket.anomaly}
                        aria-label={`${bucket.anomaly ? "Drill into anomaly" : "Bucket"}: ${new Date(bucket.start).toLocaleTimeString()} – ${bucket.count.toLocaleString()} events`}
                        onClick={() => handleAnomalyDrillIn(bucket.start, bucket.end)}
                        sx={{
                          minWidth: 12,
                          height: Math.max(12, Math.min(52, bucket.count * 2)),
                          py: 0,
                          px: 0.5,
                        }}
                        title={`${new Date(bucket.start).toLocaleTimeString()} • ${bucket.count.toLocaleString()} events${bucket.anomaly ? " • anomaly" : ""}`}
                      />
                    ))}
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button size="small" variant="text" onClick={runCategorizeQuery}>
                      Run CATEGORIZE patterns
                    </Button>
                  </Stack>
                </Box>

                {!result && !loading && (
                  <EmptyState
                    heading="No logs loaded"
                    description="Run the current query to explore logs and click values to add filters."
                  />
                )}

                {result && viewMode === "lines" && (
                  <>
                    <DataTable
                      data={result}
                      onCellClick={({ columnName, value }) => {
                        if (columnName === TRACE_ID_FIELD) {
                          handleTracePivot(value);
                          return;
                        }
                        if (columnName === MESSAGE_FIELD) {
                          setExtractSource(value);
                          setExtractMethod("DISSECT");
                          setExtractPattern("%{extracted.value}");
                          setExtractDialogOpen(true);
                          return;
                        }
                        handleCellFilter(columnName, value, false);
                      }}
                    />
                    {result.columns.some((col) => col.name === TRACE_ID_FIELD) &&
                      result.values.length > 0 && (
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            p: 1,
                            borderTop: 1,
                            borderColor: "divider",
                          }}
                        >
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<OpenInNewIcon />}
                            onClick={() => {
                              const traceColIdx = result.columns.findIndex(
                                (c) => c.name === TRACE_ID_FIELD,
                              );
                              const traceValue =
                                traceColIdx >= 0 ? result.values[0]?.[traceColIdx] : null;
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

                {result && viewMode === "chart" && (
                  <Box sx={{ p: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      Chart view uses the shared query and highlights anomaly buckets from the
                      timeline.
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Click a timeline anomaly marker to append a `CHANGE_POINT` drill-in query.
                    </Typography>
                  </Box>
                )}

                {result && viewMode === "patterns" && (
                  <List dense disablePadding>
                    {patternGroups.slice(0, 50).map((group) => (
                      <ListItem key={group.pattern} disablePadding>
                        <ListItemButton
                          onClick={() => {
                            setSearchText(`"${group.sample}"`);
                            setViewMode("lines");
                          }}
                        >
                          <ListItemText
                            primary={
                              <Typography variant="caption" noWrap title={group.pattern}>
                                {group.pattern}
                              </Typography>
                            }
                            secondary={`${group.count.toLocaleString()} matching rows`}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                    {patternGroups.length === 0 && (
                      <Box sx={{ p: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          No message patterns available for clustering.
                        </Typography>
                      </Box>
                    )}
                  </List>
                )}
              </Paper>
            </Box>
          </InsightSlot>
        </Box>
        <Dialog open={extractDialogOpen} onClose={() => setExtractDialogOpen(false)} fullWidth>
          <DialogTitle>Extract fields from message</DialogTitle>
          <DialogContent>
            <Typography variant="caption" color="text.secondary">
              Selected message: {extractSource.slice(0, 240)}
            </Typography>
            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
              <InputLabel id="logs-extract-method-label">Method</InputLabel>
              <Select
                labelId="logs-extract-method-label"
                label="Method"
                value={extractMethod}
                onChange={(event) => {
                  const method = event.target.value as ExtractMethod;
                  setExtractMethod(method);
                  setExtractPattern(
                    method === "DISSECT" ? "%{extracted.value}" : "%{GREEDYDATA:extracted.value}",
                  );
                }}
              >
                <MenuItem value="DISSECT">DISSECT</MenuItem>
                <MenuItem value="GROK">GROK</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              fullWidth
              label="Extraction pattern"
              sx={{ mt: 1 }}
              value={extractPattern}
              onChange={(event) => setExtractPattern(event.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button size="small" onClick={() => setExtractDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={handleApplyExtraction}>
              Apply {extractMethod}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </InsightSlotProvider>
  );
}
