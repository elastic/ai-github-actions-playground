import { useCallback, useEffect, useRef, useState } from "react";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import type { ElasticsearchConnection } from "../services/es";

/** Single row returned by the ranked-dimension fetch. */
export interface RankedValueRow {
  value: string;
  metric: number;
}

interface UseRankedDimensionValuesOptions {
  connection: ElasticsearchConnection;
  /** Build the ES|QL query to execute. Called on every fetch. */
  buildQuery: () => string;
  /** Column name for the dimension value (e.g. the field name). */
  dimensionColumn: string;
  /** Column name for the metric value (e.g. "count" or "samples"). */
  metricColumn: string;
  /** Reactive dependencies that should trigger a re-fetch when they change. */
  deps: readonly unknown[];
}

interface UseRankedDimensionValuesResult {
  rows: RankedValueRow[];
  loading: boolean;
  error: string | null;
}

/**
 * Shared fetch/cancel/parse/loading/error lifecycle for ranked-dimension
 * value pickers used in Logs and Profiling.
 *
 * Cancels the previous in-flight request before starting a new one and
 * normalises the response into `RankedValueRow[]`.
 */
export function useRankedDimensionValues({
  connection,
  buildQuery,
  dimensionColumn,
  metricColumn,
  deps,
}: UseRankedDimensionValuesOptions): UseRankedDimensionValuesResult {
  const [rows, setRows] = useState<RankedValueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchValues = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const client = new ElasticsearchClient(connection);
      const query = buildQuery();
      const result = await client.query({ query }, controller.signal);
      const dimCol = result.columns.findIndex((c) => c.name === dimensionColumn);
      const metricCol = result.columns.findIndex((c) => c.name === metricColumn);
      if (dimCol < 0 || metricCol < 0) {
        throw new Error(
          `Unexpected response: missing ${dimensionColumn} or ${metricColumn} column`,
        );
      }
      const parsed: RankedValueRow[] = result.values
        .map((row) => ({
          value: String(row[dimCol] ?? ""),
          metric: Number(row[metricCol] ?? 0),
        }))
        .filter((r) => r.value.length > 0);
      setRows(parsed);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      if (!controller.signal.aborted && abortRef.current === controller) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, dimensionColumn, metricColumn, ...deps]);

  useEffect(() => {
    void fetchValues();
    return () => abortRef.current?.abort();
  }, [fetchValues]);

  return { rows, loading, error };
}
