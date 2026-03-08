import { useCallback, useMemo, useRef, useState } from "react";

import { ElasticsearchClient, isElasticsearchError } from "../../services/es";
import type { ElasticsearchConnection, EsqlResponse } from "../../types";
import type { ProfilingViewMode } from "../../store/useProfilingFiltersStore";
import type { ProfilingFilters } from "../../types/pageFilters";

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

interface UseProfilingAdvancedDataParams {
  connection: ElasticsearchConnection | null;
  viewMode: ProfilingViewMode;
  filters: ProfilingFilters;
  rawQuery: string | null;
}

export function useProfilingAdvancedData({
  connection,
  viewMode,
  filters,
  rawQuery,
}: UseProfilingAdvancedDataParams) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRunByMode, setHasRunByMode] = useState<Record<ProfilingViewMode, boolean>>({
    topFunctions: false,
    stacktraces: false,
    timeline: false,
    flamegraph: false,
    flamescope: false,
  });
  const [topFunctionsRows, setTopFunctionsRows] = useState<TopFunctionRow[]>([]);
  const [timelineResult, setTimelineResult] = useState<EsqlResponse | null>(null);
  const [stacktraces, setStacktraces] = useState<SymbolizedStacktrace[]>([]);
  const [flamescopeWindow, setFlamescopeWindow] = useState<{ from: string; to: string } | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);

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
          frameTypes: String(
            readColumn(row, stacktraceResponse.columns, "Stacktrace.frame.types") ?? "",
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
            const value = readColumn(row, frameResponse.columns, "Stackframe.line.number");
            return value != null ? Number(value) : null;
          })(),
          functionOffset: (() => {
            const value = readColumn(row, frameResponse.columns, "Stackframe.function.offset");
            return value != null ? Number(value) : null;
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
    setHasRunByMode((previous) => ({ ...previous, [viewMode]: true }));
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

  const resetResults = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setError(null);
    setHasRunByMode({
      topFunctions: false,
      stacktraces: false,
      timeline: false,
      flamegraph: false,
      flamescope: false,
    });
    setTopFunctionsRows([]);
    setTimelineResult(null);
    setStacktraces([]);
    setFlamescopeWindow(null);
  }, []);

  const flamegraphTree = useMemo(() => buildFlamegraphTree(stacktraces), [stacktraces]);

  return {
    loading,
    error,
    hasRunByMode,
    topFunctionsRows,
    timelineResult,
    stacktraces,
    flamescopeWindow,
    setFlamescopeWindow,
    handleRun,
    resetResults,
    effectiveQuery,
    flamegraphTree,
  };
}
