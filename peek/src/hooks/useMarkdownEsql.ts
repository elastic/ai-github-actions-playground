import { useState, useEffect, useRef, useMemo } from "react";

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
 * 3. Executes each unique query against Elasticsearch.
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
  const blocksKey = blocks.map((b) => b.raw).join("\0");

  const [results, setResults] = useState<{
    key: string;
    values: ReadonlyMap<string, EsqlResponse>;
  }>({ key: "", values: new Map() });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (blocks.length === 0) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const uniqueBlocks = new Map<string, string>();
    for (const b of blocks) {
      if (!uniqueBlocks.has(b.raw)) uniqueBlocks.set(b.raw, b.query);
    }

    let cancelled = false;

    void (async () => {
      const next = new Map<string, EsqlResponse>();

      for (const [raw, query] of uniqueBlocks) {
        if (cancelled) return;
        if (!connection) continue;
        try {
          const datasource = createPersesEsqlDatasource(connection);
          const request = buildPersesEsqlRequest(query, { timeRange, parameters });
          const data = await datasource.execute(request, ctrl.signal);
          if (!ctrl.signal.aborted) next.set(raw, data);
        } catch {
          // Query failed — leave the raw token in place.
        }
      }

      if (!cancelled) setResults({ key: blocksKey, values: next });
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [blocks, blocksKey, connection, timeRange, parameters]);

  // Step 4 — replace resolved blocks
  if (blocks.length === 0) return interpolated;
  const currentResults = results.key === blocksKey ? results.values : new Map();
  return replaceEsqlBlocks(interpolated, currentResults);
}
