import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import type {
  ElasticsearchConnection,
  EsqlResponse,
  DashboardParameter,
  TimeRange,
} from "../types";
import {
  buildPersesEsqlRequest,
  createPersesEsqlDatasource,
} from "../services/perses/esqlDatasource";
import {
  extractEsqlBlocks,
  replaceEsqlBlocks,
  interpolateParameters,
} from "../services/markdownInterpolation";

interface UseMarkdownEsqlOptions {
  /** Raw markdown content (may contain `{{param}}` and `${esql}` tokens). */
  content: string;
  connection: ElasticsearchConnection | null;
  timeRange: TimeRange | undefined;
  parameters: DashboardParameter[] | undefined;
}

/**
 * Resolves embedded ES|QL queries inside markdown content.
 *
 * 1. First applies `{{param}}` interpolation.
 * 2. Extracts every `${esql_query}` block.
 * 3. Executes each unique query against Elasticsearch via React Query.
 * 4. Returns the final markdown with results inlined.
 *
 * While queries are in-flight, the original `${...}` tokens remain.
 */
export function useMarkdownEsql({
  content,
  connection,
  timeRange,
  parameters,
}: UseMarkdownEsqlOptions): string {
  // Step 1 — parameter interpolation (synchronous, always applied)
  const interpolated = interpolateParameters(content, parameters);

  // Step 2 — extract ES|QL blocks (memoized since interpolated is a string)
  const blocks = useMemo(() => extractEsqlBlocks(interpolated), [interpolated]);

  // Deduplicate blocks by raw token — multiple identical tokens share a query.
  const uniqueBlocks = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of blocks) {
      if (!map.has(b.raw)) map.set(b.raw, b.query);
    }
    return [...map];
  }, [blocks]);

  // Step 3 — one React Query per unique ES|QL block
  const queryResults = useQueries({
    queries: uniqueBlocks.map(([raw, query]) => ({
      queryKey: ["markdown-esql", raw, connection?.url, timeRange, parameters] as const,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const datasource = createPersesEsqlDatasource(connection!);
        const request = buildPersesEsqlRequest(query, { timeRange, parameters });
        const data = await datasource.execute(request, signal);
        return { raw, data } as { raw: string; data: EsqlResponse };
      },
      enabled: Boolean(connection) && Boolean(query),
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
  });

  // Step 4 — replace resolved blocks
  const resultsMap = useMemo(() => {
    const map = new Map<string, EsqlResponse>();
    for (const q of queryResults) {
      if (q.isSuccess && q.data) {
        map.set(q.data.raw, q.data.data);
      }
    }
    return map;
  }, [queryResults]);

  if (blocks.length === 0) return interpolated;
  return replaceEsqlBlocks(interpolated, resultsMap);
}
