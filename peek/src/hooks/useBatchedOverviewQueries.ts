import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { ElasticsearchClient } from "../services/es";
import { buildTimeParams } from "../services/datemath";
import type { EsqlResponse, TimeRange } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverviewQueryResult {
  status: "idle" | "loading" | "success" | "error";
  data?: EsqlResponse;
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

/**
 * Shared batching orchestration hook used by both `MetricOverviewGrid` and
 * `DimensionOverviewGrid`.
 *
 * - Marks items as loading while preserving prior data for display continuity.
 * - Queries in batches of `batchSize` using an `AbortSignal`.
 * - Folds results into state after each batch.
 * - On the initial discovery pass, records which items have data so subsequent
 *   refreshes only re-query those items.
 */
export function useBatchedOverviewQueries<T extends { name: string }>({
  items,
  client,
  scopeKey,
  buildQuery,
  timeRange,
  batchSize = 6,
}: Options<T>): Record<string, OverviewQueryResult> {
  const [results, setResults] = useState<Record<string, OverviewQueryResult>>({});
  const abortRef = useRef<AbortController | null>(null);
  const knownWithDataRef = useRef<Set<string> | null>(null);
  const prevScopeRef = useRef<string | null>(null);

  // Keep a stable ref so the effect can always call the latest buildQuery
  // without it being a reactive dependency (avoids requiring useCallback at
  // every call site).
  const buildQueryRef = useRef(buildQuery);
  useLayoutEffect(() => {
    buildQueryRef.current = buildQuery;
  });

  useEffect(() => {
    if (!client || items.length === 0) return;

    // When the data scope changes, clear the cache so we do full discovery.
    if (scopeKey !== prevScopeRef.current) {
      prevScopeRef.current = scopeKey;
      knownWithDataRef.current = null;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    // On first load (or after scope change) query everything; on subsequent
    // refreshes only re-query items that previously had data.
    const isRefresh = (knownWithDataRef.current?.size ?? 0) > 0;
    const itemsToQuery = isRefresh
      ? items.filter((item) => knownWithDataRef.current!.has(item.name))
      : items;

    const runBatches = async () => {
      // Mark queried items as loading but keep previous data for display continuity.
      setResults((prev) => {
        const next = { ...prev };
        for (const item of itemsToQuery) {
          next[item.name] = { status: "loading", data: prev[item.name]?.data };
        }
        return next;
      });

      for (let i = 0; i < itemsToQuery.length; i += batchSize) {
        if (signal.aborted) return;
        const batch = itemsToQuery.slice(i, i + batchSize);
        const promises = batch.map(async (item) => {
          const queryDef = buildQueryRef.current(item);
          try {
            const params = buildTimeParams(queryDef.esql, timeRange);
            const result = await client.query(
              params.length > 0 ? { query: queryDef.esql, params } : { query: queryDef.esql },
              signal,
            );
            return { name: item.name, status: "success" as const, data: result as EsqlResponse };
          } catch {
            if (signal.aborted) return null;
            return { name: item.name, status: "error" as const };
          }
        });

        const batchResults = await Promise.all(promises);
        if (signal.aborted) return;

        setResults((prev) => {
          const next = { ...prev };
          for (const r of batchResults) {
            if (r) {
              next[r.name] = { status: r.status, data: r.data };
            }
          }
          return next;
        });
      }

      // After the initial discovery pass, record which items had data so
      // subsequent refreshes only re-query those.
      if (!isRefresh) {
        setResults((current) => {
          const withData = new Set<string>();
          for (const [name, r] of Object.entries(current)) {
            if (r.status === "success" && r.data && r.data.values.length > 0) {
              const metricIdx = r.data.columns.findIndex((c) => c.name === "metric");
              if (metricIdx >= 0 && r.data.values.some((row) => row[metricIdx] != null)) {
                withData.add(name);
              }
            }
          }
          knownWithDataRef.current = withData;
          return current;
        });
      }
    };

    void runBatches();

    return () => {
      abortRef.current?.abort();
    };
  }, [client, items, scopeKey, timeRange, batchSize]);

  return results;
}
