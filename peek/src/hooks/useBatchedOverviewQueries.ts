import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";

import type { ElasticsearchClient } from "../services/es";
import { buildTimeParams } from "../services/datemath";
import type { EsqlResponse, TimeRange } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverviewQueryResult {
  status: "idle" | "loading" | "success" | "error";
  data?: EsqlResponse;
  /** Short description of the failure when `status` is `"error"`. */
  errorReason?: string;
}

/**
 * Return `true` when an overview query result contains at least one non-null
 * "metric" value.  Used by both MetricOverviewGrid and DimensionOverviewGrid
 * to filter items that actually have displayable data.
 */
export function hasOverviewData(result: OverviewQueryResult | undefined): boolean {
  if (!result?.data || result.data.values.length === 0) return false;
  if (result.status !== "success" && result.status !== "loading") return false;
  const metricIdx = result.data.columns.findIndex((c) => c.name === "metric");
  if (metricIdx < 0) return false;
  return result.data.values.some((row) => row[metricIdx] != null);
}

interface Options<T extends { name: string }> {
  /** Items to query (metrics or dimension fields). */
  items: T[];
  /** Elasticsearch client — hook is a no-op when null. */
  client: ElasticsearchClient | null;
  /**
   * Opaque string that identifies the current data scope. When it changes the
   * internal "known-with-data" cache is cleared so a full discovery pass runs.
   */
  scopeKey: string;
  /**
   * Per-item query builder.  Called once per item per batch; should return an
   * ES|QL query string.  May close over time-range and other query parameters.
   * Identity changes are ignored — the latest version is always used.
   */
  buildQuery: (item: T) => { esql: string };
  /** Time range forwarded to `buildTimeParams` for `?_tstart`/`?_tend` resolution. */
  timeRange: TimeRange;
  /** How many items to query in parallel per batch. Defaults to 6. */
  batchSize?: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface BatchedOverviewResult {
  results: Record<string, OverviewQueryResult>;
  /** Re-run only queries currently in "error" state. */
  retryFailed: () => void;
}

/**
 * Shared batching orchestration hook used by both `MetricOverviewGrid` and
 * `DimensionOverviewGrid`.
 *
 * Uses TanStack Query (`useQueries`) to manage per-item query state.
 * On the initial discovery pass, records which items have data so subsequent
 * refreshes only re-query those items.
 */
export function useBatchedOverviewQueries<T extends { name: string }>({
  items,
  client,
  scopeKey,
  buildQuery,
  timeRange,
}: Options<T>): BatchedOverviewResult {
  // Keep a stable ref so the queryFn can always call the latest buildQuery
  // without it being a reactive dependency (avoids requiring useCallback at
  // every call site).
  const buildQueryRef = useRef(buildQuery);
  useLayoutEffect(() => {
    buildQueryRef.current = buildQuery;
  });

  // Discovery state: tracks which items returned data after the first pass.
  const [knownWithData, setKnownWithData] = useState<Set<string> | null>(null);
  const prevScopeRef = useRef<string | null>(null);

  // Reset the known-with-data cache when the data scope changes.
  if (scopeKey !== prevScopeRef.current) {
    prevScopeRef.current = scopeKey;
    if (knownWithData !== null) {
      setKnownWithData(null);
    }
  }

  const isRefresh = (knownWithData?.size ?? 0) > 0;

  const queries = useQueries({
    queries: items.map((item) => ({
      queryKey: ["overview", scopeKey, item.name, timeRange] as const,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const queryDef = buildQueryRef.current(item);
        const params = buildTimeParams(queryDef.esql, timeRange);
        const result = await client!.query(
          Object.keys(params).length > 0
            ? { query: queryDef.esql, params }
            : { query: queryDef.esql },
          signal,
        );
        return result as EsqlResponse;
      },
      enabled: Boolean(client) && (!isRefresh || knownWithData!.has(item.name)),
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
  });

  // Build the results record from query states.
  const results: Record<string, OverviewQueryResult> = {};
  for (let i = 0; i < items.length; i++) {
    const q = queries[i]!;
    const item = items[i]!;
    if (q.isFetching) {
      results[item.name] = { status: "loading", data: q.data };
    } else if (q.isError) {
      results[item.name] = {
        status: "error",
        errorReason: q.error instanceof Error ? q.error.message : "Unknown error",
      };
    } else if (q.isSuccess) {
      results[item.name] = { status: "success", data: q.data };
    } else {
      results[item.name] = { status: "idle" };
    }
  }

  // Once all queries have settled, (re-)compute the known-with-data set.
  // This runs both after the initial discovery pass and after retryFailed
  // recoveries so that recovered items are included in future refreshes.
  const allSettled = queries.length > 0 && queries.every((q) => !q.isFetching);
  useEffect(() => {
    if (!allSettled) return;
    const withData = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const q = queries[i]!;
      const item = items[i]!;
      if (q.isSuccess && q.data) {
        const data = q.data as EsqlResponse;
        if (data.values.length === 0) continue;
        const metricIdx = data.columns.findIndex((c) => c.name === "metric");
        if (metricIdx >= 0 && data.values.some((row) => row[metricIdx] != null)) {
          withData.add(item.name);
        }
      }
    }
    setKnownWithData((prev) => {
      if (prev !== null && prev.size === withData.size && [...withData].every((n) => prev.has(n))) {
        return prev;
      }
      return withData;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSettled]);

  const retryFailed = useCallback(() => {
    const failedNames: string[] = [];
    for (let i = 0; i < items.length; i++) {
      if (queries[i]?.isError) {
        failedNames.push(items[i]!.name);
      }
    }
    if (failedNames.length === 0) return;

    // When in refresh mode, add failed items to the known set so they
    // become enabled. TanStack Query auto-fetches enabled queries in
    // error state. When not in refresh mode, all items are already
    // enabled; trigger a manual refetch.
    setKnownWithData((prev) => {
      if (prev === null) return prev;
      const next = new Set(prev);
      for (const name of failedNames) next.add(name);
      return next;
    });

    for (let i = 0; i < items.length; i++) {
      if (queries[i]?.isError) {
        void queries[i]!.refetch();
      }
    }
  }, [items, queries]);

  return { results, retryFailed };
}
