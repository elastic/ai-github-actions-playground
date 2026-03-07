import { useQuery } from "@tanstack/react-query";

import type { DataFetchResult } from "../types/query";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

export interface NodesHotThreadsQuery {
  nodeId?: string;
  ignoreIdleThreads?: boolean;
  interval?: string;
  snapshots?: number;
  threads?: number;
  timeout?: string;
  type?: "cpu" | "wait" | "block" | "gpu" | "mem";
  sort?: "cpu" | "wait" | "block" | "gpu" | "mem";
}

export function useNodesHotThreads(queryParams: NodesHotThreadsQuery): DataFetchResult<string> & {
  refresh: () => void;
} {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: [
      "nodes-hot-threads",
      connection?.url,
      queryParams.nodeId ?? "",
      queryParams.ignoreIdleThreads ?? true,
      queryParams.interval ?? "",
      queryParams.snapshots ?? "",
      queryParams.threads ?? "",
      queryParams.timeout ?? "",
      queryParams.type ?? "",
      queryParams.sort ?? "",
    ],
    queryFn: createQueryFn((client) => client.getNodesHotThreads(queryParams)),
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
