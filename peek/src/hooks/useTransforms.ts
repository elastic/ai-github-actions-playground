import type {
  GetTransformsResponse,
  GetTransformStatsResponse,
  TransformRow,
} from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useFetchResource } from "./useFetchResource";

function joinTransformData(
  definitions: GetTransformsResponse,
  stats: GetTransformStatsResponse,
): TransformRow[] {
  const statsById = new Map(stats.transforms.map((s) => [s.id, s]));

  return definitions.transforms.map((def) => {
    const st = statsById.get(def.id);
    return {
      id: def.id,
      description: def.description ?? "",
      state: st?.state ?? "unknown",
      healthStatus: st?.health?.status ?? "unknown",
      type: def.sync ? "continuous" : "batch",
      sourceIndices: def.source?.index ?? [],
      destIndex: def.dest?.index ?? "",
      destPipeline: def.dest?.pipeline ?? "",
      frequency: def.frequency ?? "",
      docsProcessed: st?.stats?.documents_processed ?? 0,
      docsIndexed: st?.stats?.documents_indexed ?? 0,
      searchFailures: st?.stats?.search_failures ?? 0,
      indexFailures: st?.stats?.index_failures ?? 0,
      checkpoint: st?.checkpointing?.last?.checkpoint ?? 0,
      avgCheckpointDurationMs: st?.stats?.exponential_avg_checkpoint_duration_ms ?? 0,
      nodeName: st?.node?.name ?? "",
      searchTimeMs: st?.stats?.search_time_in_ms ?? 0,
      indexTimeMs: st?.stats?.index_time_in_ms ?? 0,
      processingTimeMs: st?.stats?.processing_time_in_ms ?? 0,
      deleteTimeMs: st?.stats?.delete_time_in_ms ?? 0,
      triggerCount: st?.stats?.trigger_count ?? 0,
      pagesProcessed: st?.stats?.pages_processed ?? 0,
      docsDeleted: st?.stats?.documents_deleted ?? 0,
      expAvgDocsIndexed: st?.stats?.exponential_avg_documents_indexed ?? 0,
      expAvgDocsProcessed: st?.stats?.exponential_avg_documents_processed ?? 0,
      nextCheckpoint: st?.checkpointing?.next?.checkpoint ?? null,
      nextCheckpointDocsProcessed:
        st?.checkpointing?.next?.checkpoint_progress?.documents_processed ?? null,
      nextCheckpointDocsIndexed:
        st?.checkpointing?.next?.checkpoint_progress?.documents_indexed ?? null,
      lastCheckpointTimeMs: st?.checkpointing?.last?.time_upper_bound_millis ?? null,
      syncField: def.sync?.time?.field ?? "",
      syncDelay: def.sync?.time?.delay ?? "",
      retentionMaxAge: def.retention_policy?.time?.max_age ?? "",
      maxPageSearchSize: def.settings?.max_page_search_size ?? null,
      docsPerSecond: def.settings?.docs_per_second ?? null,
      definition: def,
      stats: st ?? { id: def.id, state: "unknown" },
    };
  });
}

export function useTransforms(): DataFetchResult<TransformRow[]> & { refresh: () => void } {
  return useFetchResource<[GetTransformsResponse, GetTransformStatsResponse], TransformRow[]>({
    queryKey: (url) => ["transforms", url],
    queryFn: (client) => Promise.all([client.getTransforms(), client.getTransformStats()]),
    select: ([definitions, stats]) => joinTransformData(definitions, stats),
  });
}
