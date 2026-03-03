import { useQuery } from "@tanstack/react-query";

import type { EsqlResponse } from "../types";
import type { EsqlQueryParams } from "../services/es";
import { createPersesEsqlDatasource } from "../services/perses/esqlDatasource";
import { useConnectionStore } from "../store/useConnectionStore";

import { useRefetchOnConnectionChange } from "./useEsQuery";

interface UseSimpleEsqlQueryOptions {
  /** The ES|QL query string to execute. Pass `null` to disable execution. */
  query: string | null;
  /** Optional custom React Query key. Defaults to `["esql", connectionUrl, trimmedQuery, request]`. */
  queryKey?: readonly unknown[];
  /** Optional request builder — transforms the query text into a full `EsqlQueryParams`. */
  buildRequest?: (queryText: string) => EsqlQueryParams;
  /** When `false`, prevents automatic execution even when a query is provided. */
  enabled?: boolean;
}

/**
 * Lightweight ES|QL query hook backed by React Query for read-only queries
 * that only need `data`, `loading`, and `error`.
 *
 * The query runs automatically when `query` is non-null, the connection is
 * active, and `enabled` is `true` (the default). React Query handles caching,
 * deduplication, and refetching on connection changes.
 *
 * **When to use `useSimpleEsqlQuery`:**
 * - Your component declaratively renders the result of a static or
 *   parameter-driven ES|QL query.
 * - You only need `data` / `loading` / `error` — no extra metadata.
 *
 * **When to use `useEsqlQuery` instead:**
 * - You need imperative `runQuery()` control (e.g. run on button click).
 * - You need per-step execution tracking (`activeStep`, `stepDurationsMs`).
 * - You need profiling support (`profileMode`, `lastRunProfile`).
 * - You need partial-result metadata (`lastRunIsPartial`, `lastRunPartialMetadata`).
 * - You need CodeMirror query-context integration (`queryContextView`).
 */
export function useSimpleEsqlQuery({
  query,
  queryKey,
  buildRequest,
  enabled = true,
}: UseSimpleEsqlQueryOptions) {
  const connection = useConnectionStore((s) => s.connection);
  const trimmedQuery = query?.trim() ?? "";
  let requestBuildError: Error | null = null;
  let request: EsqlQueryParams | null = null;
  if (trimmedQuery.length > 0) {
    try {
      request = buildRequest ? buildRequest(trimmedQuery) : { query: trimmedQuery };
    } catch (error) {
      requestBuildError = error instanceof Error ? error : new Error(String(error));
    }
  }

  const effectiveEnabled =
    enabled && Boolean(connection) && Boolean(trimmedQuery) && requestBuildError == null;

  const result = useQuery<EsqlResponse>({
    queryKey: queryKey ?? ["esql", connection?.url, trimmedQuery, request],
    queryFn: async ({ signal }) => {
      if (!connection || !request) {
        throw new Error(
          "Cannot execute ES|QL query without an active connection and non-empty query.",
        );
      }
      const datasource = createPersesEsqlDatasource(connection);
      return datasource.execute(request, signal);
    },
    enabled: effectiveEnabled,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useRefetchOnConnectionChange(connection, () => {
    if (effectiveEnabled) {
      void result.refetch();
    }
  });

  return {
    data: result.data ?? null,
    loading: result.isFetching,
    error:
      requestBuildError != null
        ? requestBuildError.message
        : result.error == null
          ? null
          : result.error instanceof Error
            ? result.error.message
            : String(result.error),
    refetch: result.refetch,
  };
}
