import { useQuery } from "@tanstack/react-query";

import { isElasticsearchError, type GetWatchResponse } from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

export function useWatcherWatch(watchId: string): DataFetchResult<GetWatchResponse> & {
  refresh: () => void;
} {
  const { connection, createQueryFn } = useEsQuery();
  const trimmedId = watchId.trim();
  const query = useQuery({
    queryKey: ["watcher-watch", connection?.url, trimmedId],
    queryFn: createQueryFn(async (client) => {
      try {
        return await client.getWatcherWatch(trimmedId);
      } catch (error: unknown) {
        if (isElasticsearchError(error) && error.status === 404) {
          throw new Error(`Watch "${trimmedId}" not found.`, { cause: error });
        }
        if (isElasticsearchError(error) && error.status === 403) {
          throw new Error("Forbidden: missing permission to read watcher watches.", { cause: error });
        }
        throw error;
      }
    }),
    enabled: Boolean(connection) && trimmedId.length > 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useRefetchOnConnectionChange(connection, query.refetch);

  const refresh = () => {
    if (!trimmedId) return;
    void query.refetch();
  };

  if (!connection) return { status: "idle", refresh };
  if (!trimmedId) return { status: "idle", refresh };
  if (query.isFetching) return { status: "loading", refresh };
  if (query.isError) return { status: "error", error: query.error.message, refresh };
  if (query.data) return { status: "success", data: query.data, refresh };
  return { status: "idle", refresh };
}
