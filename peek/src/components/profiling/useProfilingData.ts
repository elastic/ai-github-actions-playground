import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NavigateFunction } from "react-router-dom";

import { PAGE_MANIFEST } from "../../routes/manifest";
import { ElasticsearchClient, isElasticsearchError } from "../../services/es";
import { escapeEsqlString } from "../../services/es/esqlUtils";
import type { ElasticsearchConnection, EsqlResponse } from "../../types";
import type { ProfilingFilters } from "../../types/pageFilters";
import { EMPTY_PROFILING_FILTERS } from "../../types/pageFilters";

import {
  buildProfilingEventsQuery,
  buildProfilingFlamescopeQuery,
  buildProfilingTimelineQuery,
  buildStackframeLookupQuery,
  buildStacktraceLookupQuery,
  buildTopFunctionsRequest,
  type ProfilingFocusDimension,
} from "./profilingQueryBuilder";
import type {
  FlamegraphNode,
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

export type ViewMode = "topFunctions" | "stacktraces" | "timeline" | "flamegraph" | "flamescope";

function readColumn(row: unknown[], columns: Array<{ name: string }>, field: string): unknown {
  const index = columns.findIndex((column) => column.name === field);
  return index >= 0 ? row[index] : null;
}

/** Map a focus dimension + value to a partial ProfilingFilters override. */
function dimensionToFilters(
  dimension: ProfilingFocusDimension | null,
  value: string | null,
): Partial<ProfilingFilters> {
  if (!dimension || !value) return {};
  switch (dimension) {
    case "service.name":
      return { serviceName: value };
    case "host.name":
      return { hostName: value };
    case "process.executable.name":
      return { executableName: value };
    case "process.thread.name":
      return { threadName: value };
  }
}

interface UseProfilingDataParams {
  connection: ElasticsearchConnection | null;
  viewMode: ViewMode;
  dimension: ProfilingFocusDimension | null;
  value: string | null;
  timeFrom: string;
  timeTo: string;
  showResults: boolean;
  navigate: NavigateFunction;
  setDiscoverQueryDraft: (draft: string) => void;
}

interface UseProfilingDataResult {
  loading: boolean;
  error: string | null;
  hasRun: boolean;
  topFunctionsRows: TopFunctionRow[];
  timelineResult: EsqlResponse | null;
  stacktraces: SymbolizedStacktrace[];
  flamescopeWindow: { from: string; to: string } | null;
  setFlamescopeWindow: (window: { from: string; to: string } | null) => void;
  flamegraphTree: FlamegraphNode;
  handleRun: () => Promise<void>;
  handleOpenInQueryLab: () => void;
  handleFrameClick: (frameName: string) => void;
  resetResults: () => void;
}

export function useProfilingData({
  connection,
  viewMode,
  dimension,
  value,
  timeFrom,
  timeTo,
  showResults,
  navigate,
  setDiscoverQueryDraft,
}: UseProfilingDataParams): UseProfilingDataResult {
  const abortRef = useRef<AbortController | null>(null);
  const hasRunRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [topFunctionsRows, setTopFunctionsRows] = useState<TopFunctionRow[]>([]);
  const [timelineResult, setTimelineResult] = useState<EsqlResponse | null>(null);
  const [stacktraces, setStacktraces] = useState<SymbolizedStacktrace[]>([]);
  const [flamescopeWindow, setFlamescopeWindow] = useState<{ from: string; to: string } | null>(
    null,
  );

  const filters = useMemo<ProfilingFilters>(
    () => ({
      ...EMPTY_PROFILING_FILTERS,
      ...dimensionToFilters(dimension, value),
      timeFrom,
      timeTo,
    }),
    [dimension, value, timeFrom, timeTo],
  );

  const effectiveQuery = useMemo(() => {
    if (viewMode === "timeline") return buildProfilingTimelineQuery(filters);
    if (viewMode === "flamescope") return buildProfilingFlamescopeQuery(filters);
    return buildProfilingEventsQuery(filters);
  }, [viewMode, filters]);

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
        setFlamescopeWindow(null);
        return;
      }

      const stacktraceResponse = await client.query(
        { query: buildStacktraceLookupQuery(stacktraceIds) },
        signal,
      );
      const stacktraceRows: StacktraceFrameMap[] = stacktraceResponse.values
        .map((row) => ({
          id: String(readColumn(row, stacktraceResponse.columns, "_id") ?? ""),
          frameIds: String(
            readColumn(row, stacktraceResponse.columns, "Stacktrace.frame.ids") ?? "",
          ),
          frameTypes: String(
            readColumn(row, stacktraceResponse.columns, "Stacktrace.frame.types") ?? "",
          ),
        }))
        .filter((item) => item.id.length > 0);

      const frameIds = [...new Set(stacktraceRows.flatMap((row) => parseFrameIds(row.frameIds)))];
      const frameResponse = await client.query(
        { query: buildStackframeLookupQuery(frameIds) },
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
    hasRunRef.current = true;
    setHasRun(true);
    setLoading(true);
    setError(null);
    // Clear stale results from a previous view mode so the empty state
    // doesn't briefly show while the new query is in flight.
    setTopFunctionsRows([]);
    setTimelineResult(null);
    setStacktraces([]);
    try {
      if (viewMode === "topFunctions") {
        await runTopFunctions(client, controller.signal);
      } else if (viewMode === "timeline") {
        await runTimeline(client, controller.signal);
      } else {
        await runStacktraces(client, controller.signal);
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [connection, runTopFunctions, runTimeline, runStacktraces, viewMode]);

  // Auto-run whenever we are in the results view and dependencies change
  useEffect(() => {
    if (!showResults || !connection) return;
    void handleRun();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResults, viewMode, filters, connection]);

  const handleOpenInQueryLab = useCallback(() => {
    if (viewMode === "topFunctions") return;
    const draft =
      viewMode === "flamescope" && flamescopeWindow
        ? buildProfilingFlamescopeQuery({
            ...filters,
            timeFrom: flamescopeWindow.from,
            timeTo: flamescopeWindow.to,
          })
        : effectiveQuery;
    setDiscoverQueryDraft(draft);
    navigate(PAGE_MANIFEST.discover.path);
  }, [effectiveQuery, filters, flamescopeWindow, navigate, setDiscoverQueryDraft, viewMode]);

  const handleFrameClick = useCallback(
    (frameName: string) => {
      if (frameName === "(unknown)") return;
      const draft = `${effectiveQuery}\n| WHERE Stackframe.function.name == "${escapeEsqlString(frameName)}"`;
      setDiscoverQueryDraft(draft);
      navigate(PAGE_MANIFEST.discover.path);
    },
    [effectiveQuery, navigate, setDiscoverQueryDraft],
  );

  const flamegraphTree = useMemo(() => buildFlamegraphTree(stacktraces), [stacktraces]);

  const resetResults = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    hasRunRef.current = false;
    setHasRun(false);
    setTopFunctionsRows([]);
    setStacktraces([]);
    setTimelineResult(null);
    setFlamescopeWindow(null);
    setError(null);
  }, []);

  return {
    loading,
    error,
    hasRun,
    topFunctionsRows,
    timelineResult,
    stacktraces,
    flamescopeWindow,
    setFlamescopeWindow,
    flamegraphTree,
    handleRun,
    handleOpenInQueryLab,
    handleFrameClick,
    resetResults,
  };
}
