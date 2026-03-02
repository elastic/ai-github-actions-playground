import { useQuery } from "@tanstack/react-query";

import { fetchFieldStats, type FieldStats, type ElasticsearchConnection } from "../services/es";
import type { DataFetchResult } from "../types/query";

import { esQueryFn } from "./useEsQuery";

export function useFieldStats(
  connection: ElasticsearchConnection | null,
  streamName: string,
  fieldName: string,
  fieldType: string,
): DataFetchResult<FieldStats> {
  const query = useQuery({
    queryKey: ["field-stats", connection?.url, streamName, fieldName, fieldType],
    queryFn: connection
      ? esQueryFn(connection, (client) => fetchFieldStats(client, streamName, fieldName, fieldType))
      : undefined,
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (!connection) return { status: "idle" };
  if (query.isFetching) return { status: "loading" };
  if (query.isError) return { status: "error", error: query.error.message };
  if (query.data) return { status: "success", data: query.data };
  return { status: "idle" };
}
