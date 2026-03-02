import { useQuery } from "@tanstack/react-query";

import type { FieldCapsResponse } from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

export function useFieldCaps(dataStreamName: string | null): DataFetchResult<FieldCapsResponse> {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["field-caps", connection?.url, dataStreamName],
    queryFn: createQueryFn((client) => client.getFieldCaps(dataStreamName!)),
    enabled: Boolean(connection && dataStreamName),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useRefetchOnConnectionChange(connection, query.refetch);

  if (!connection || !dataStreamName) return { status: "idle" };
  if (query.isFetching) return { status: "loading" };
  if (query.isError) return { status: "error", error: query.error.message };
  if (query.data) return { status: "success", data: query.data };
  return { status: "idle" };
}
