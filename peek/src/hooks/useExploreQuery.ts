import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { ElasticsearchClient, isElasticsearchError, buildExplorerQuery } from "../services/es";
import type { AggregationType, ExplorerFilter, MetricType } from "../services/es";
import { buildTimeParams } from "../services/datemath";
import type { TimeRange } from "../types/dashboard";
import { useConnectionStore } from "../store/useConnectionStore";
import type { ExplorerState } from "../store/useExplorerStore";

/**
 * Runs an ES|QL explorer query via React Query, replacing the manual
 * `useEffect` + `AbortController` pattern that previously lived in
 * `ExplorePage`.
 *
 * The returned `queryResult` matches the shape expected by the explorer
 * store so that downstream UI components need no changes.
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
}: {
  indexPattern: string;
  selectedMetric: string | null;
  metricType: MetricType;
  aggregation: AggregationType;
  filters: ExplorerFilter[];
  groupBy: string | null;
  timeRange: TimeRange;
  enabled: boolean;
}): ExplorerState["queryResult"] {
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

  const query = useQuery({
    queryKey: [
      "explore-query",
      connection?.url,
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
      if (!connection || !queryDef) throw new Error("Missing connection or query definition");
      const client = new ElasticsearchClient(connection);
      const params = buildTimeParams(queryDef.esql, timeRange);
      return client.query(
        Object.keys(params).length > 0
          ? { query: queryDef.esql, params }
          : { query: queryDef.esql },
        signal,
      );
    },
    enabled: Boolean(connection && queryDef && enabled),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (!enabled || !selectedMetric || !indexPattern) {
    return { status: "idle" };
  }
  if (query.isFetching) {
    return { status: "loading", esql: queryDef?.esql };
  }
  if (query.isError) {
    return {
      status: "error",
      esql: queryDef?.esql,
      error: isElasticsearchError(query.error) ? query.error.message : String(query.error),
    };
  }
  if (query.data) {
    return {
      status: "success",
      esql: queryDef?.esql,
      data: query.data,
      executionTimeMs: query.data.executionTimeMs,
    };
  }
  return { status: "idle", esql: queryDef?.esql };
}
