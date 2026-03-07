import { useQuery } from "@tanstack/react-query";

import type { NodesStatsResponse } from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

export function useIngestNodeStats(): DataFetchResult<NodesStatsResponse> & {
  refresh: () => void;
} {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["ingest-node-stats", connection?.url],
    queryFn: createQueryFn((client) => client.getNodeStats()),
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
