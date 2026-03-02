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

    void (async () => {
      if (!connection) {
        setResults({ key: blocksKey, values: new Map() });
        return;
      }

      const tasks = [...uniqueBlocks].map(
        ([raw, query]) =>
          async (): Promise<readonly [string, EsqlResponse]> => {
            const datasource = createPersesEsqlDatasource(connection);
            const request = buildPersesEsqlRequest(query, { timeRange, parameters });
            const data = await datasource.execute(request, ctrl.signal);
            return [raw, data] as const;
          },
      );
      const MAX_CONCURRENCY = 6;
      const runTask = async (
        task: () => Promise<readonly [string, EsqlResponse]>,
      ): Promise<PromiseSettledResult<readonly [string, EsqlResponse]>> => {
        try {
          return { status: "fulfilled", value: await task() };
        } catch (reason) {
          return { status: "rejected", reason };
        }
      };
      const entries: Array<PromiseSettledResult<readonly [string, EsqlResponse]>> = [];
      for (let i = 0; i < tasks.length; i += MAX_CONCURRENCY) {
        const batch = tasks.slice(i, i + MAX_CONCURRENCY);
        entries.push(...(await Promise.all(batch.map(runTask))));
      }

      if (ctrl.signal.aborted) return;

      const next = new Map<string, EsqlResponse>();
      for (const entry of entries) {
        if (entry.status === "fulfilled") next.set(...entry.value);
      }
      setResults({ key: blocksKey, values: next });
    })();

    return () => {
      ctrl.abort();
    };
  }, [blocks, blocksKey, connection, timeRange, parameters]);

  // Step 4 — replace resolved blocks
  if (blocks.length === 0) return interpolated;
  const currentResults = results.key === blocksKey ? results.values : new Map();
  return replaceEsqlBlocks(interpolated, currentResults);
}
