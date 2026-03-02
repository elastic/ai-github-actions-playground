import { useQuery } from "@tanstack/react-query";

import type { IngestPipeline } from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useEsQuery } from "./useEsQuery";

export type PipelineEntry = { name: string; pipeline: IngestPipeline };

export function useIngestPipelines(): DataFetchResult<PipelineEntry[]> & {
  refresh: () => void;
} {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["ingest-pipelines", connection?.url],
    queryFn: createQueryFn((client) => client.getIngestPipelines()),
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    select: (data) =>
      Object.entries(data)
        .map(([name, pipeline]) => ({ name, pipeline }))
        .sort((a, b) => a.name.localeCompare(b.name)),
  });

  const refresh = () => {
    void query.refetch();
  };

  if (!connection) return { status: "idle", refresh };
  if (query.isFetching) return { status: "loading", refresh };
  if (query.isError) return { status: "error", error: query.error.message, refresh };
  if (query.data) return { status: "success", data: query.data, refresh };
  return { status: "idle", refresh };
}
