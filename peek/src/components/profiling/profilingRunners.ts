/**
 * Shared profiling execution runners.
 *
 * Extracted from useProfilingData and useProfilingAdvancedData to eliminate
 * duplicated query execution, stacktrace/frame join, and mode-dispatch logic.
 *
 * Each function is a pure async operation that returns data — callers own state
 * management and can apply results however they need.
 */
import type { ElasticsearchClient } from "../../services/es";
import { buildColumnAccessor } from "../../services/es/columnUtils";
import type { EsqlResponse } from "../../types";
import type { ProfilingFilters } from "../../types/pageFilters";
import type { ProfilingViewMode } from "../../store/useProfilingFiltersStore";

import {
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
import { joinStacktraces, normalizeTopFunctions, parseFrameIds } from "./profilingUtils";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ProfilingRunResult {
  topFunctionsRows: TopFunctionRow[];
  timelineResult: EsqlResponse | null;
  stacktraces: SymbolizedStacktrace[];
}

// ---------------------------------------------------------------------------
// Individual runners
// ---------------------------------------------------------------------------

/** Run the top-functions API and normalize the response. */
export async function fetchTopFunctions(
  client: ElasticsearchClient,
  filters: ProfilingFilters,
  signal: AbortSignal,
): Promise<TopFunctionRow[]> {
  const response = await client.getTopFunctions(buildTopFunctionsRequest(filters), signal);
  return normalizeTopFunctions(response);
}

/** Run an ES|QL timeline query. */
export async function fetchTimeline(
  client: ElasticsearchClient,
  query: string,
  signal: AbortSignal,
): Promise<EsqlResponse> {
  return client.query({ query }, signal);
}

/** Run the stacktrace pipeline: events → stacktrace lookup → frame lookup → join. */
export async function fetchStacktraces(
  client: ElasticsearchClient,
  query: string,
  signal: AbortSignal,
): Promise<SymbolizedStacktrace[]> {
  const eventsResponse = await client.query({ query }, signal);
  const getEvent = buildColumnAccessor(eventsResponse.columns);
  const events: ProfilingEvent[] = eventsResponse.values
    .map((row) => ({
      timestamp: String(getEvent(row, "@timestamp") ?? ""),
      stacktraceId: String(getEvent(row, "Stacktrace.id") ?? ""),
      count: Number(getEvent(row, "Stacktrace.count") ?? 0),
      serviceName: String(getEvent(row, "service.name") ?? ""),
      hostName: String(getEvent(row, "host.name") ?? ""),
    }))
    .filter((event) => event.stacktraceId.length > 0);

  const stacktraceIds = [...new Set(events.map((event) => event.stacktraceId))];
  if (stacktraceIds.length === 0) return [];

  const stacktraceResponse = await client.query(
    { query: buildStacktraceLookupQuery(stacktraceIds) },
    signal,
  );
  const getTrace = buildColumnAccessor(stacktraceResponse.columns);
  const stacktraceRows: StacktraceFrameMap[] = stacktraceResponse.values
    .map((row) => ({
      id: String(getTrace(row, "_id") ?? ""),
      frameIds: String(getTrace(row, "Stacktrace.frame.ids") ?? ""),
      frameTypes: String(getTrace(row, "Stacktrace.frame.types") ?? ""),
    }))
    .filter((item) => item.id.length > 0);

  const frameIds = [...new Set(stacktraceRows.flatMap((row) => parseFrameIds(row.frameIds)))];
  const frameResponse = await client.query({ query: buildStackframeLookupQuery(frameIds) }, signal);
  const getFrame = buildColumnAccessor(frameResponse.columns);
  const frames: FrameSymbol[] = frameResponse.values
    .map((row) => ({
      id: String(getFrame(row, "_id") ?? ""),
      functionName: String(getFrame(row, "Stackframe.function.name") ?? "(unknown)"),
      fileName: String(getFrame(row, "Stackframe.file.name") ?? ""),
      lineNumber: (() => {
        const v = getFrame(row, "Stackframe.line.number");
        return v != null ? Number(v) : null;
      })(),
      functionOffset: (() => {
        const v = getFrame(row, "Stackframe.function.offset");
        return v != null ? Number(v) : null;
      })(),
    }))
    .filter((frame) => frame.id.length > 0);

  return joinStacktraces(events, stacktraceRows, frames);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Execute the appropriate profiling query based on the current view mode.
 *
 * Returns a {@link ProfilingRunResult} with only the relevant field populated;
 * the caller applies the result to its own state.
 */
export async function executeProfilingRun(
  client: ElasticsearchClient,
  signal: AbortSignal,
  viewMode: ProfilingViewMode,
  filters: ProfilingFilters,
  effectiveQuery: string,
): Promise<ProfilingRunResult> {
  if (viewMode === "topFunctions") {
    return {
      topFunctionsRows: await fetchTopFunctions(client, filters, signal),
      timelineResult: null,
      stacktraces: [],
    };
  }
  if (viewMode === "timeline") {
    return {
      topFunctionsRows: [],
      timelineResult: await fetchTimeline(client, effectiveQuery, signal),
      stacktraces: [],
    };
  }
  // stacktraces | flamegraph | flamescope — all use the stacktrace pipeline
  return {
    topFunctionsRows: [],
    timelineResult: null,
    stacktraces: await fetchStacktraces(client, effectiveQuery, signal),
  };
}
