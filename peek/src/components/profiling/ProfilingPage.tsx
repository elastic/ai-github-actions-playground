import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";

import { PAGE_MANIFEST } from "../../routes/manifest";
import { ElasticsearchClient, isElasticsearchError } from "../../services/es";
import { escapeEsqlString } from "../../services/es/esqlUtils";
import { TRACE_TIME_RANGE_OPTIONS } from "../timePresets";
import ProfilingFlamegraph from "../visualizations/ProfilingFlamegraph";
import ProfilingFlamescope from "../visualizations/ProfilingFlamescope";
import TimeSeriesChart from "../visualizations/TimeSeriesChart";
import { useConnectionStore } from "../../store/useConnectionStore";
import { useQueryStore } from "../../store/useQueryStore";
import { useProfilingStore } from "../../store/useProfilingStore";
import type { EsqlResponse } from "../../types";

import {
  buildProfilingEventsQuery,
  buildProfilingFlamescopeQuery,
  buildProfilingTimelineQuery,
  buildStackframeLookupQuery,
  buildStacktraceLookupQuery,
  buildTopFunctionsRequest,
} from "./profilingQueryBuilder";
import type {
  FrameSymbol,
  ProfilingEvent,
  StacktraceFrameMap,
  SymbolizedStacktrace,
  TopFunctionRow,
} from "./profilingUtils";
import {
  buildFlamegraphTree,
  joinStacktraces,
  normalizeTopFunctions,
  parseFrameIds,
} from "./profilingUtils";

function readColumn(row: unknown[], columns: Array<{ name: string }>, field: string): unknown {
  const index = columns.findIndex((column) => column.name === field);
  return index >= 0 ? row[index] : null;
}

export default function ProfilingPage() {
  const navigate = useNavigate();
  const connection = useConnectionStore((state) => state.connection);
  const setDiscoverQueryDraft = useQueryStore((state) => state.setDiscoverQueryDraft);
  const {
    filters,
    rawQuery,
    viewMode,
    expandedStacktraceIds,
    updateFilters,
    setRawQuery,
    setViewMode,
    toggleExpandedStacktraceId,
    resetFilters,
  } = useProfilingStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [topFunctionsRows, setTopFunctionsRows] = useState<TopFunctionRow[]>([]);
  const [timelineResult, setTimelineResult] = useState<EsqlResponse | null>(null);
  const [stacktraces, setStacktraces] = useState<SymbolizedStacktrace[]>([]);
  const [flamescopeWindow, setFlamescopeWindow] = useState<{ from: string; to: string } | null>(
    null,
  );

  const generatedQuery = useMemo(() => {
    if (viewMode === "timeline") return buildProfilingTimelineQuery(filters);
    if (viewMode === "flamescope") return buildProfilingFlamescopeQuery(filters);
    return buildProfilingEventsQuery(filters);
  }, [viewMode, filters]);
  const effectiveQuery = rawQuery ?? generatedQuery;

  const runTopFunctions = useCallback(
    async (client: ElasticsearchClient, signal: AbortSignal) => {
      const response = await client.getTopFunctions(buildTopFunctionsRequest(filters), signal);
      setTopFunctionsRows(normalizeTopFunctions(response));
      setTimelineResult(null);
      setStacktraces([]);
    },
    [filters],
  );

  const runTimeline = useCallback(
    async (client: ElasticsearchClient, signal: AbortSignal) => {
      const result = await client.query({ query: effectiveQuery }, signal);
      setTimelineResult(result);
      setTopFunctionsRows([]);
      setStacktraces([]);
    },
    [effectiveQuery],
  );

  const runStacktraces = useCallback(
    async (client: ElasticsearchClient, signal: AbortSignal) => {
      const eventsResponse = await client.query({ query: effectiveQuery }, signal);
      const events: ProfilingEvent[] = eventsResponse.values
        .map((row) => ({
          timestamp: String(readColumn(row, eventsResponse.columns, "@timestamp") ?? ""),
          stacktraceId: String(readColumn(row, eventsResponse.columns, "Stacktrace.id") ?? ""),
          count: Number(readColumn(row, eventsResponse.columns, "Stacktrace.count") ?? 0),
          serviceName: String(readColumn(row, eventsResponse.columns, "service.name") ?? ""),
          hostName: String(readColumn(row, eventsResponse.columns, "host.name") ?? ""),
        }))
        .filter((event) => event.stacktraceId.length > 0);
      const stacktraceIds = [...new Set(events.map((event) => event.stacktraceId))];
      if (stacktraceIds.length === 0) {
        setStacktraces([]);
        setTopFunctionsRows([]);
        setTimelineResult(null);
        return;
      }

      const stacktraceResponse = await client.query(
        {
          query: buildStacktraceLookupQuery(stacktraceIds),
        },
        signal,
      );
      const stacktraceRows: StacktraceFrameMap[] = stacktraceResponse.values
        .map((row) => ({
          id: String(readColumn(row, stacktraceResponse.columns, "_id") ?? ""),
          frameIds: String(
            readColumn(row, stacktraceResponse.columns, "Stacktrace.frame.ids") ?? "",
          ),
        }))
        .filter((item) => item.id.length > 0);

      const frameIds = [...new Set(stacktraceRows.flatMap((row) => parseFrameIds(row.frameIds)))];
      const frameResponse = await client.query(
        {
          query: buildStackframeLookupQuery(frameIds),
        },
        signal,
      );
      const frames: FrameSymbol[] = frameResponse.values
        .map((row) => ({
          id: String(readColumn(row, frameResponse.columns, "_id") ?? ""),
          functionName: String(
            readColumn(row, frameResponse.columns, "Stackframe.function.name") ?? "(unknown)",
          ),
          fileName: String(readColumn(row, frameResponse.columns, "Stackframe.file.name") ?? ""),
          lineNumber: (() => {
            const v = readColumn(row, frameResponse.columns, "Stackframe.line.number");
            return v != null ? Number(v) : null;
          })(),
          functionOffset: (() => {
            const v = readColumn(row, frameResponse.columns, "Stackframe.function.offset");
            return v != null ? Number(v) : null;
          })(),
        }))
        .filter((frame) => frame.id.length > 0);

      setStacktraces(joinStacktraces(events, stacktraceRows, frames));
      setTopFunctionsRows([]);
      setTimelineResult(null);
      setFlamescopeWindow(null);
    },
    [effectiveQuery],
  );

  const handleRun = useCallback(async () => {
    if (!connection) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const client = new ElasticsearchClient(connection);
    setLoading(true);
    setError(null);
    try {
      if (viewMode === "topFunctions") {
        await runTopFunctions(client, controller.signal);
      } else if (viewMode === "timeline") {
        await runTimeline(client, controller.signal);
      } else {
        await runStacktraces(client, controller.signal);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [connection, runTopFunctions, runTimeline, runStacktraces, viewMode]);

  const handleOpenInQueryLab = useCallback(() => {
    if (viewMode === "topFunctions") return;
    const draft =
      viewMode === "flamescope" && flamescopeWindow
        ? `${effectiveQuery}\n| WHERE @timestamp >= "${escapeEsqlString(flamescopeWindow.from)}" AND @timestamp < "${escapeEsqlString(flamescopeWindow.to)}"`
        : effectiveQuery;
    setDiscoverQueryDraft(draft);
    navigate(PAGE_MANIFEST.discover.path);
  }, [effectiveQuery, flamescopeWindow, navigate, setDiscoverQueryDraft, viewMode]);

  const flamegraphTree = useMemo(() => buildFlamegraphTree(stacktraces), [stacktraces]);

  const handleFrameClick = useCallback(
    (frameName: string) => {
      if (frameName === "(unknown)") return;
      const draft = `${effectiveQuery}\n| WHERE Stackframe.function.name == "${escapeEsqlString(frameName)}"`;

      setDiscoverQueryDraft(draft);
      navigate(PAGE_MANIFEST.discover.path);
    },
    [effectiveQuery, navigate, setDiscoverQueryDraft],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Profiling Explorer
          </Typography>
          <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
            <Button size="small" variant="text" onClick={resetFilters}>
              Reset Filters
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={handleOpenInQueryLab}
              disabled={viewMode === "topFunctions"}
            >
              Open in Query Lab
            </Button>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5, mb: 1 }}>
          {(["topFunctions", "stacktraces", "timeline", "flamegraph", "flamescope"] as const).map(
            (mode) => (
              <Chip
                key={mode}
                label={
                  mode === "topFunctions"
                    ? "Top Functions"
                    : mode === "stacktraces"
                      ? "Stacktraces"
                      : mode === "timeline"
                        ? "Timeline"
                        : mode === "flamegraph"
                          ? "Flamegraph"
                          : "Flamescope"
                }
                size="small"
                variant={viewMode === mode ? "filled" : "outlined"}
                color={viewMode === mode ? "primary" : "default"}
                onClick={() => setViewMode(mode)}
              />
            ),
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
          <TextField
            size="small"
            label="Executable"
            value={filters.executableName ?? ""}
            onChange={(event) => updateFilters({ executableName: event.target.value || null })}
          />
          <TextField
            size="small"
            label="Thread"
            value={filters.threadName ?? ""}
            onChange={(event) => updateFilters({ threadName: event.target.value || null })}
          />
          <TextField
            size="small"
            label="Service"
            value={filters.serviceName ?? ""}
            onChange={(event) => updateFilters({ serviceName: event.target.value || null })}
          />
          <TextField
            size="small"
            label="Host"
            value={filters.hostName ?? ""}
            onChange={(event) => updateFilters({ hostName: event.target.value || null })}
          />
          <TextField
            size="small"
            select
            label="Time range"
            value={filters.timeFrom}
            onChange={(event) => {
              const selected = TRACE_TIME_RANGE_OPTIONS.find(
                (option) => option.from === event.target.value,
              );
              if (selected?.from && selected.to) {
                updateFilters({ timeFrom: selected.from, timeTo: selected.to });
              }
            }}
            sx={{ minWidth: 160 }}
          >
            {TRACE_TIME_RANGE_OPTIONS.filter((opt) => opt.from !== null).map((opt) => (
              <MenuItem key={opt.label} value={opt.from ?? ""}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <TextField
          fullWidth
          multiline
          minRows={4}
          label={
            viewMode === "topFunctions"
              ? "Top functions request body (JSON preview)"
              : "ES|QL query preview"
          }
          value={
            viewMode === "topFunctions"
              ? JSON.stringify(buildTopFunctionsRequest(filters), null, 2)
              : effectiveQuery
          }
          onChange={(event) => {
            if (viewMode !== "topFunctions") setRawQuery(event.target.value);
          }}
          InputProps={{ readOnly: viewMode === "topFunctions" }}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
          <Button variant="contained" size="small" onClick={handleRun} disabled={loading}>
            {loading ? <CircularProgress size={14} color="inherit" /> : "Run"}
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined" sx={{ flex: 1, minHeight: 320, overflow: "auto" }}>
        {!loading &&
          topFunctionsRows.length === 0 &&
          stacktraces.length === 0 &&
          !timelineResult && (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Run the selected view to load profiling data.
              </Typography>
            </Box>
          )}
        {viewMode === "topFunctions" && topFunctionsRows.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Function</TableCell>
                <TableCell align="right">Self count</TableCell>
                <TableCell align="right">Total count</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {topFunctionsRows.map((row, index) => (
                <TableRow key={`${row.functionName}-${index}`}>
                  <TableCell>{row.functionName}</TableCell>
                  <TableCell align="right">{row.selfCount ?? "—"}</TableCell>
                  <TableCell align="right">{row.totalCount ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {viewMode === "timeline" && timelineResult && (
          <Box sx={{ height: 360 }}>
            <TimeSeriesChart data={timelineResult} options={{ smooth: true, showArea: false }} />
          </Box>
        )}
        {viewMode === "stacktraces" && stacktraces.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Stacktrace ID</TableCell>
                <TableCell align="right">Count</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Host</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stacktraces.map((stacktrace) => (
                <Fragment key={stacktrace.stacktraceId}>
                  <TableRow
                    hover
                    onClick={() => toggleExpandedStacktraceId(stacktrace.stacktraceId)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                      {stacktrace.stacktraceId}
                    </TableCell>
                    <TableCell align="right">{stacktrace.count}</TableCell>
                    <TableCell>{stacktrace.serviceName || "—"}</TableCell>
                    <TableCell>{stacktrace.hostName || "—"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} sx={{ py: 0 }}>
                      <Collapse in={expandedStacktraceIds.has(stacktrace.stacktraceId)}>
                        <Box sx={{ p: 1 }}>
                          {stacktrace.frames.map((frame) => (
                            <Typography
                              key={`${stacktrace.stacktraceId}-${frame.frameId}`}
                              variant="caption"
                              sx={{ display: "block", fontFamily: "monospace" }}
                            >
                              {frame.functionName}{" "}
                              {frame.fileName
                                ? `(${frame.fileName}${frame.lineNumber ? `:${frame.lineNumber}` : ""})`
                                : ""}
                            </Typography>
                          ))}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
        {viewMode === "flamegraph" && stacktraces.length > 0 && (
          <Box sx={{ height: 480 }}>
            <ProfilingFlamegraph tree={flamegraphTree} onFrameClick={handleFrameClick} />
          </Box>
        )}
        {viewMode === "flamescope" && stacktraces.length > 0 && (
          <ProfilingFlamescope
            stacktraces={stacktraces}
            onWindowChange={setFlamescopeWindow}
            onFrameClick={handleFrameClick}
          />
        )}
      </Paper>
    </Box>
  );
}
