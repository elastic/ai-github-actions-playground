import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { ElasticsearchClient, isElasticsearchError, buildExplorerQuery } from "../services/es";
import type { AggregationType, ExplorerFilter, MetricType } from "../services/es";
import { buildTimeParams } from "../services/datemath";
import type { TimeRange } from "../types/dashboard";
import { useConnectionStore } from "../store/useConnectionStore";

/** Shape returned by `useExploreQuery` for downstream UI components. */
export interface ExploreQueryResult {
  status: "idle" | "loading" | "success" | "error";
  esql?: string;
  data?: { columns: Array<{ name: string; type: string }>; values: unknown[][] };
  error?: string;
  executionTimeMs?: number;
}

/**
 * Runs an ES|QL explorer query via React Query, replacing the manual
 * `useEffect` + `AbortController` pattern that previously lived in
 * `ExplorePage`.
 *
 * The returned `queryResult` matches the shape expected by the explorer
 * store so that downstream UI components need no changes.
 *
 * When `queryOverride` is provided (non-null), it is used as the ES|QL
 * query instead of the generated one — this supports direct editing of
 * the query in the CodeMirror editor.
 */
export function useExploreQuery({
  indexPattern,
  selectedMetric,
  metricType,
  aggregation,
  filters,
  groupBy,
  timeRange,
  enabled,
  queryOverride,
}: {
  indexPattern: string;
  selectedMetric: string | null;
  metricType: MetricType;
  aggregation: AggregationType;
  filters: ExplorerFilter[];
  groupBy: string | null;
  timeRange: TimeRange;
  enabled: boolean;
  /** When non-null, use this ES|QL instead of the generated query. */
  queryOverride?: string | null;
}): ExploreQueryResult {
  const connection = useConnectionStore((s) => s.connection);

  const queryDef = useMemo(() => {
    if (!selectedMetric || !indexPattern || !enabled) return null;
    return buildExplorerQuery({
      indexPattern,
      metricField: selectedMetric,
      metricType,
      aggregation,
      filters,
      groupBy: groupBy ?? undefined,
      timeRange,
    });
  }, [indexPattern, selectedMetric, metricType, aggregation, filters, groupBy, timeRange, enabled]);

  // Use override query if provided, otherwise use the generated query
  const effectiveEsql = queryOverride ?? queryDef?.esql ?? null;

  const query = useQuery({
    queryKey: [
      "explore-query",
      connection?.url,
      // When override is active, key on the override text; otherwise use structured params
      queryOverride ?? null,
      indexPattern,
      selectedMetric,
      metricType,
      aggregation,
      JSON.stringify(filters),
      groupBy,
      timeRange.from,
      timeRange.to,
    ],
    queryFn: async ({ signal }) => {
      if (!connection || !effectiveEsql) throw new Error("Missing connection or query definition");
      const client = new ElasticsearchClient(connection);
      // Skip time params for override queries — user-edited queries contain concrete time expressions
      if (queryOverride) {
        return client.query({ query: queryOverride }, signal);
      }
      const params = buildTimeParams(effectiveEsql, timeRange);
      return client.query(
        Object.keys(params).length > 0
          ? { query: effectiveEsql, params }
          : { query: effectiveEsql },
        signal,
      );
    },
    enabled: Boolean(connection && effectiveEsql && enabled),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (!enabled || !selectedMetric || !indexPattern) {
    return { status: "idle" };
  }
  if (query.isFetching) {
    return { status: "loading", esql: effectiveEsql ?? undefined };
  }
  if (query.isError) {
    return {
      status: "error",
      esql: effectiveEsql ?? undefined,
      error: isElasticsearchError(query.error) ? query.error.message : String(query.error),
    };
  }
  if (query.data) {
    return {
      status: "success",
      esql: effectiveEsql ?? undefined,
      data: query.data,
      executionTimeMs: query.data.executionTimeMs,
    };
  }
  return { status: "idle", esql: effectiveEsql ?? undefined };
}
