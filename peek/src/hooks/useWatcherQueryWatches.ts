import { useQuery } from "@tanstack/react-query";

import type { QueryWatchesResponse } from "../services/es";
import { isElasticsearchError } from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

interface UseWatcherQueryWatchesOptions {
  from?: number;
  size?: number;
}

export function useWatcherQueryWatches({
  from = 0,
  size = 100,
}: UseWatcherQueryWatchesOptions = {}): DataFetchResult<QueryWatchesResponse> & {
  refresh: () => void;
} {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["watcher-query-watches", connection?.url, from, size],
    queryFn: createQueryFn(async (client) => {
      try {
        return await client.queryWatcherWatches({ from, size });
      } catch (error: unknown) {
        if (isElasticsearchError(error) && error.status === 403) {
          throw new Error("Forbidden: missing permission to query watcher watches.", {
            cause: error,
          });
        }
        throw error;
      }
    }),
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useRefetchOnConnectionChange(connection, query.refetch);

  const refresh = () => {
    void query.refetch();
  };

  if (!connection) return { status: "idle", refresh };
  if (query.isFetching) return { status: "loading", refresh };
  if (query.isError) return { status: "error", error: query.error.message, refresh };
  if (query.data) return { status: "success", data: query.data, refresh };
  return { status: "idle", refresh };
}
