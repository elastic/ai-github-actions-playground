import { useState, useEffect, useRef } from "react";

import { ElasticsearchClient } from "../services/es";
import type { EsqlQueryParams } from "../services/es";
import type {
  ElasticsearchConnection,
  EsqlResponse,
  DashboardParameter,
  TimeRange,
} from "../types";
import { buildQueryParams } from "../services/datemath";
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

  // Step 2 — extract ES|QL blocks
  const blocks = extractEsqlBlocks(interpolated);

  const [results, setResults] = useState<ReadonlyMap<string, EsqlResponse>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (blocks.length === 0) {
      setResults(new Map());
      return;
    }

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
          const client = new ElasticsearchClient(connection);
          const body: EsqlQueryParams = { query };
          if (timeRange) {
            body.filter = {
              range: { "@timestamp": { gte: timeRange.from, lte: timeRange.to } },
            };
            const qp = buildQueryParams(query, timeRange, parameters);
            if (qp.length > 0) body.params = qp;
          }
          const data = await client.query(body, ctrl.signal);
          if (!ctrl.signal.aborted) next.set(raw, data);
        } catch {
          // Query failed — leave the raw token in place.
        }
      }

      if (!cancelled) setResults(next);
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
    };
    // We serialise blocks by their raw strings to avoid re-running on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    blocks.map((b) => b.raw).join("\0"),
    connection,
    timeRange,
    parameters,
  ]);

  // Step 4 — replace resolved blocks
  if (blocks.length === 0) return interpolated;
  return replaceEsqlBlocks(interpolated, results);
}
