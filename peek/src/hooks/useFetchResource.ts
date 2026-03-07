import { useQuery } from "@tanstack/react-query";

import type { ElasticsearchClient } from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

export interface FetchResourceConfig<TRaw, TData> {
  queryKey: (connectionUrl?: string) => (string | undefined)[];
  queryFn: (client: ElasticsearchClient) => Promise<TRaw>;
  select?: (data: TRaw) => TData;
}

export function useFetchResource<TRaw, TData = TRaw>(
  config: FetchResourceConfig<TRaw, TData>,
): DataFetchResult<TData> & { refresh: () => void } {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: config.queryKey(connection?.url),
    queryFn: createQueryFn((client) => config.queryFn(client)),
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...(config.select ? { select: config.select } : {}),
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
