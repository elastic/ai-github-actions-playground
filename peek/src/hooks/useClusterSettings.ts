import { useQuery } from "@tanstack/react-query";

import { isElasticsearchError, type ClusterSettingsResponse } from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

export function useClusterSettings(): DataFetchResult<ClusterSettingsResponse> & {
  refresh: () => void;
} {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["cluster-settings", connection?.url],
    queryFn: createQueryFn(async (client) => {
      try {
        return await client.getClusterSettings();
      } catch (error: unknown) {
        if (isElasticsearchError(error) && error.status === 403) {
          throw new Error("Forbidden: missing permission to read cluster settings.", {
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
