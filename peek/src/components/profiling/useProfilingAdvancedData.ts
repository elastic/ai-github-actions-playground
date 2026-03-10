import { useCallback, useMemo, useState } from "react";

import { ElasticsearchClient, isElasticsearchError } from "../../services/es";
import { useAbortableQueryRun } from "../../hooks/useAbortableQueryRun";
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
  const { run, cancel } = useAbortableQueryRun();

  const generatedQuery = useMemo(() => {
    if (viewMode === "timeline") return buildProfilingTimelineQuery(filters);
    if (viewMode === "flamescope") return buildProfilingFlamescopeQuery(filters);
    return buildProfilingEventsQuery(filters);
  }, [viewMode, filters]);
  const effectiveQuery = rawQuery ?? generatedQuery;

  const handleRun = useCallback(async () => {
    if (!connection) return;
    const client = new ElasticsearchClient(connection);
    await run((signal) => executeProfilingRun(client, signal, viewMode, filters, effectiveQuery), {
      onStart: () => {
        setLoading(true);
        setError(null);
        setHasRunByMode((previous) => ({ ...previous, [viewMode]: true }));
      },
      onSuccess: (result) => {
        setTopFunctionsRows(result.topFunctionsRows);
        setTimelineResult(result.timelineResult);
        setStacktraces(result.stacktraces);
        if (viewMode !== "topFunctions" && viewMode !== "timeline") {
          setFlamescopeWindow(null);
        }
      },
      onError: (err) => {
        setError(isElasticsearchError(err) ? err.message : String(err));
      },
      onSettled: () => {
        setLoading(false);
      },
    });
  }, [connection, run, viewMode, filters, effectiveQuery]);

  const resetResults = useCallback(() => {
    cancel();
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
  }, [cancel]);

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
