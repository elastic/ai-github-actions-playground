import { useQuery } from "@tanstack/react-query";

import type { CatIndexRecord, IndexStatsResponse } from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";
import { useFetchResource } from "./useFetchResource";

export function useIndices(): DataFetchResult<CatIndexRecord[]> & {
  refresh: () => void;
} {
  return useFetchResource<CatIndexRecord[], CatIndexRecord[]>({
    queryKey: (url) => ["indices", url],
    queryFn: (client) => client.getCatIndices(),
    select: (data) => [...data].sort((a, b) => a.index.localeCompare(b.index)),
  });
}

export interface IndexDetailData {
  mappings: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  indexStats: IndexStatsResponse | null;
}

/**
 * Fetches mappings, settings, and stats for the given index.
 *
 * When `indexName` is `null` the result is `{ status: "idle" }`.
 */
export function useIndexDetail(indexName: string | null): DataFetchResult<IndexDetailData> {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["index-detail", connection?.url, indexName],
    queryFn: createQueryFn((client) =>
      Promise.allSettled([
        client.getIndexMappings(indexName!),
        client.getIndexSettings(indexName!),
        client.getIndexStats(indexName!),
      ]),
    ),
    enabled: Boolean(connection && indexName),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    select: (results): IndexDetailData => {
      const [mappingsResult, settingsResult, statsResult] = results;
      return {
        mappings: mappingsResult.status === "fulfilled" ? mappingsResult.value : null,
        settings: settingsResult.status === "fulfilled" ? settingsResult.value : null,
        indexStats: statsResult.status === "fulfilled" ? statsResult.value : null,
      };
    },
  });
  useRefetchOnConnectionChange(connection, query.refetch);

  if (!connection || !indexName) return { status: "idle" };
  if (query.isFetching) return { status: "loading" };
  if (query.isError) return { status: "error", error: query.error.message };
  if (query.data) return { status: "success", data: query.data };
  return { status: "idle" };
}
