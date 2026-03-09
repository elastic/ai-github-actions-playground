import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ElasticsearchClient, isElasticsearchError } from "../../services/es";
import { escapeEsqlString } from "../../services/es/esqlUtils";
import { useAbortableQueryRun } from "../../hooks/useAbortableQueryRun";
import { useOpenInDiscover } from "../../hooks/useOpenInDiscover";
import type { ElasticsearchConnection, EsqlResponse } from "../../types";
import type { ProfilingFilters } from "../../types/pageFilters";
import { EMPTY_PROFILING_FILTERS } from "../../types/pageFilters";

import {
  buildProfilingEventsQuery,
  buildProfilingFlamescopeQuery,
  buildProfilingTimelineQuery,
  type ProfilingFocusDimension,
} from "./profilingQueryBuilder";
import type { FlamegraphNode, SymbolizedStacktrace, TopFunctionRow } from "./profilingUtils";
import { buildFlamegraphTree } from "./profilingUtils";
import { executeProfilingRun } from "./profilingRunners";

export type ViewMode = "topFunctions" | "stacktraces" | "timeline" | "flamegraph" | "flamescope";

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
}: UseProfilingDataParams): UseProfilingDataResult {
  const openInDiscover = useOpenInDiscover();
  const { run, cancel } = useAbortableQueryRun();
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

  const handleRun = useCallback(async () => {
    if (!connection) return;
    const client = new ElasticsearchClient(connection);
    await run((signal) => executeProfilingRun(client, signal, viewMode, filters, effectiveQuery), {
      onStart: () => {
        hasRunRef.current = true;
        setHasRun(true);
        setLoading(true);
        setError(null);
        // Clear stale results from a previous view mode so the empty state
        // doesn't briefly show while the new query is in flight.
        setTopFunctionsRows([]);
        setTimelineResult(null);
        setStacktraces([]);
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

  // Auto-run whenever we are in the results view and dependencies change
  useEffect(() => {
    if (!showResults || !connection) return;
    void handleRun();
    return () => cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleRun reads latest closure values; including it would create a rerun loop
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
    openInDiscover(draft);
  }, [effectiveQuery, filters, flamescopeWindow, openInDiscover, viewMode]);

  const handleFrameClick = useCallback(
    (frameName: string) => {
      if (frameName === "(unknown)") return;
      const draft = `${effectiveQuery}\n| WHERE Stackframe.function.name == "${escapeEsqlString(frameName)}"`;
      openInDiscover(draft);
    },
    [effectiveQuery, openInDiscover],
  );

  const flamegraphTree = useMemo(() => buildFlamegraphTree(stacktraces), [stacktraces]);

  const resetResults = useCallback(() => {
    cancel();
    setLoading(false);
    hasRunRef.current = false;
    setHasRun(false);
    setTopFunctionsRows([]);
    setStacktraces([]);
    setTimelineResult(null);
    setFlamescopeWindow(null);
    setError(null);
  }, [cancel]);

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
