import { useCallback, useEffect, useRef, useState } from "react";

import type { ElasticsearchConnection } from "../services/es";
import { ElasticsearchClient } from "../services/es";
import type { TimeRange } from "../types/dashboard";
import { timeRangeToEsqlFilter } from "../components/logs/logsQueryBuilder";
import type { LogsFocusDimension } from "../components/logs/logsDimensions";
import { LOGS_DIMENSION_LABELS } from "../components/logs/logsDimensions";

export type TileCountState = "loading" | "visible" | "hidden" | "error";

export type TileCounts = Record<LogsFocusDimension, TileCountState>;

const DIMENSIONS = Object.keys(LOGS_DIMENSION_LABELS) as LogsFocusDimension[];

function makeInitialCounts(): TileCounts {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, "loading"])) as TileCounts;
}

function makeInitialSubtexts(): Record<LogsFocusDimension, string | null> {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, null])) as Record<
    LogsFocusDimension,
    string | null
  >;
}

/**
 * Fetch a distinct entity count per dimension tile for the given time range.
 * Returns "visible" (count > 0), "hidden" (count = 0), "error" (query failed), or "loading".
 * The "All logs" tile is not included — it is always shown.
 */
export function useLogsTileCounts(
  connection: ElasticsearchConnection | null,
  timeRange: TimeRange,
  enabled: boolean = true,
): { counts: TileCounts; subtexts: Record<LogsFocusDimension, string | null> } {
  const [counts, setCounts] = useState<TileCounts>(makeInitialCounts);
  const [subtexts, setSubtexts] =
    useState<Record<LogsFocusDimension, string | null>>(makeInitialSubtexts);
  const abortRef = useRef<AbortController | null>(null);
  const timeRangeRef = useRef(timeRange);
  timeRangeRef.current = timeRange;

  const fetchCounts = useCallback(async () => {
    if (!connection || !enabled) {
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const nextCounts = makeInitialCounts();
    const nextSubtexts = makeInitialSubtexts();
    setCounts({ ...nextCounts });
    setSubtexts({ ...nextSubtexts });

    const client = new ElasticsearchClient(connection);
    const timeFilter = timeRangeToEsqlFilter(timeRangeRef.current);

    await Promise.all(
      DIMENSIONS.map(async (dimension) => {
        try {
          const query = `FROM logs-* | WHERE ${timeFilter} | WHERE ${dimension} IS NOT NULL AND ${dimension} != "" | STATS count = COUNT_DISTINCT(${dimension}) | LIMIT 1`;
          const result = await client.query({ query }, controller.signal);
          if (controller.signal.aborted) return;
          const countCol = result.columns.findIndex((c) => c.name === "count");
          const count = countCol >= 0 ? Number(result.values[0]?.[countCol] ?? 0) : 0;
          const state: TileCountState = count > 0 ? "visible" : "hidden";
          const labels = LOGS_DIMENSION_LABELS[dimension];
          const noun = count === 1 ? labels.singular.toLowerCase() : labels.plural.toLowerCase();
          const subtext = count > 0 ? `${count.toLocaleString()} ${noun}` : null;
          nextCounts[dimension] = state;
          nextSubtexts[dimension] = subtext;
        } catch {
          if (controller.signal.aborted) return;
          nextCounts[dimension] = "error";
        }
      }),
    );
    if (controller.signal.aborted) return;
    setCounts({ ...nextCounts });
    setSubtexts({ ...nextSubtexts });
  }, [connection, enabled]);

  useEffect(() => {
    void fetchCounts();
    return () => abortRef.current?.abort();
  }, [fetchCounts, timeRange]);

  return { counts, subtexts };
}
