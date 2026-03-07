// ---------------------------------------------------------------------------
// Transform API types
// ---------------------------------------------------------------------------

/** A single transform definition returned by GET /_transform */
export interface TransformDefinition {
  id: string;
  description?: string;
  create_time?: number;
  version?: string;
  source: {
    index: string[];
    query?: Record<string, unknown>;
  };
  dest: {
    index: string;
    pipeline?: string;
  };
  frequency?: string;
  sync?: {
    time?: {
      field?: string;
      delay?: string;
    };
  };
  settings?: {
    docs_per_second?: number | null;
    max_page_search_size?: number;
    align_checkpoints?: boolean;
  };
  retention_policy?: {
    time?: {
      field?: string;
      max_age?: string;
    };
  };
}

/** Response from GET /_transform */
export interface GetTransformsResponse {
  count: number;
  transforms: TransformDefinition[];
}

/** Runtime stats for a single transform returned by GET /_transform/_stats */
export interface TransformStatsEntry {
  id: string;
  state: string;
  health?: {
    status?: string;
  };
  node?: {
    id?: string;
    name?: string;
  };
  stats?: {
    documents_processed?: number;
    documents_indexed?: number;
    documents_deleted?: number;
    trigger_count?: number;
    pages_processed?: number;
    search_failures?: number;
    index_failures?: number;
    search_time_in_ms?: number;
    index_time_in_ms?: number;
    processing_time_in_ms?: number;
    delete_time_in_ms?: number;
    exponential_avg_checkpoint_duration_ms?: number;
    exponential_avg_documents_indexed?: number;
    exponential_avg_documents_processed?: number;
  };
  checkpointing?: {
    last?: {
      checkpoint?: number;
      time_upper_bound_millis?: number;
    };
    next?: {
      checkpoint?: number;
      time_upper_bound_millis?: number;
      checkpoint_progress?: {
        documents_processed?: number;
        documents_indexed?: number;
      };
    };
  };
}

/** Response from GET /_transform/_stats */
export interface GetTransformStatsResponse {
  count: number;
  transforms: TransformStatsEntry[];
}

/** Flattened transform row for the table, joining definition + stats. */
export interface TransformRow {
  id: string;
  description: string;
  state: string;
  healthStatus: string;
  type: "continuous" | "batch";
  sourceIndices: string[];
  destIndex: string;
  destPipeline: string;
  frequency: string;
  docsProcessed: number;
  docsIndexed: number;
  searchFailures: number;
  indexFailures: number;
  checkpoint: number;
  avgCheckpointDurationMs: number;
  nodeName: string;
  searchTimeMs: number;
  indexTimeMs: number;
  processingTimeMs: number;
  deleteTimeMs: number;
  triggerCount: number;
  pagesProcessed: number;
  docsDeleted: number;
  expAvgDocsIndexed: number;
  expAvgDocsProcessed: number;
  nextCheckpoint: number | null;
  nextCheckpointDocsProcessed: number | null;
  nextCheckpointDocsIndexed: number | null;
  lastCheckpointTimeMs: number | null;
  syncField: string;
  syncDelay: string;
  retentionMaxAge: string;
  maxPageSearchSize: number | null;
  docsPerSecond: number | null;
  definition: TransformDefinition;
  stats: TransformStatsEntry;
}
