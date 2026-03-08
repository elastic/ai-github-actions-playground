import { useCallback, useMemo, useRef, useState } from "react";

import { ElasticsearchClient, isElasticsearchError } from "../../services/es";
import type { ElasticsearchConnection, EsqlResponse } from "../../types";
import type { ProfilingViewMode } from "../../store/useProfilingFiltersStore";
import type { ProfilingFilters } from "../../types/pageFilters";

import {
  buildProfilingEventsQuery,
  buildProfilingFlamescopeQuery,
  buildProfilingTimelineQuery,
} from "./profilingQueryBuilder";
import type { SymbolizedStacktrace, TopFunctionRow } from "./profilingUtils";
import { buildFlamegraphTree } from "./profilingUtils";
import { executeProfilingRun } from "./profilingRunners";

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
      const result = await executeProfilingRun(
        client,
        controller.signal,
        viewMode,
        filters,
        effectiveQuery,
      );
      setTopFunctionsRows(result.topFunctionsRows);
      setTimelineResult(result.timelineResult);
      setStacktraces(result.stacktraces);
      if (viewMode !== "topFunctions" && viewMode !== "timeline") {
        setFlamescopeWindow(null);
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [connection, viewMode, filters, effectiveQuery]);

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
