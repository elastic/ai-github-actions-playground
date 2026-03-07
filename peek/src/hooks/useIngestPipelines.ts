import type { GetIngestPipelinesResponse, IngestPipeline } from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useFetchResource } from "./useFetchResource";

export type PipelineEntry = { name: string; pipeline: IngestPipeline };

export function useIngestPipelines(): DataFetchResult<PipelineEntry[]> & {
  refresh: () => void;
} {
  return useFetchResource<GetIngestPipelinesResponse, PipelineEntry[]>({
    queryKey: (url) => ["ingest-pipelines", url],
    queryFn: (client) => client.getIngestPipelines(),
    select: (data) =>
      Object.entries(data)
        .map(([name, pipeline]) => ({ name, pipeline }))
        .sort((a, b) => a.name.localeCompare(b.name)),
  });
}
