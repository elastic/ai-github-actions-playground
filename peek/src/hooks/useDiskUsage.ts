import { useQuery } from "@tanstack/react-query";

import type { DiskUsageIndexEntry } from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useEsQuery } from "./useEsQuery";

export function useDiskUsage(
  indexName: string | null,
): DataFetchResult<DiskUsageIndexEntry | null> & { analyze: () => void } {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["disk-usage", connection?.url, indexName],
    queryFn: createQueryFn(async (client) => {
      const data = await client.getIndexDiskUsage(indexName!);
      const entry = data[indexName!] as DiskUsageIndexEntry | undefined;
      return entry ?? null;
    }),
    enabled: false, // only run on demand via refetch
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const analyze = () => {
    if (connection && indexName) void query.refetch();
  };

  if (!connection || !indexName) return { status: "idle", analyze };
  if (query.isFetching) return { status: "loading", analyze };
  if (query.isError) return { status: "error", error: query.error.message, analyze };
  if (query.data !== undefined && query.dataUpdatedAt > 0)
    return { status: "success", data: query.data, analyze };
  return { status: "idle", analyze };
}
