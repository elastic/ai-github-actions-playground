import type { components, operations } from "./types.generated";

// ---------------------------------------------------------------------------
// Index, data stream, and field capability types
// ---------------------------------------------------------------------------

export type ResolveIndexResponse =
  operations["indices-resolve-index"]["responses"][200]["content"]["application/json"];

export type GetDataStreamsResponse =
  operations["indices-get-data-stream"]["responses"][200]["content"]["application/json"];

export type DataStreamInfo = GetDataStreamsResponse["data_streams"][number];

export type ResolveIndexDataStreamInfo = ResolveIndexResponse["data_streams"][number];

export type FieldCapsResponse =
  operations["field-caps-2"]["responses"][200]["content"]["application/json"];

export type FieldCapability = components["schemas"]["_global.field_caps.FieldCapability"];

/** One record from GET /_cat/indices?format=json&bytes=b */
export interface CatIndexRecord {
  index: string;
  health: string;
  status: string;
  /** Number of primary shards (string from cat API) */
  pri: string;
  /** Number of replica shards (string from cat API) */
  rep: string;
  "docs.count": string | null;
  "docs.deleted": string | null;
  /** Store size in bytes (string from cat API) */
  "store.size": string | null;
  /** Primary store size in bytes (string from cat API) */
  "pri.store.size": string | null;
}

/** Shard-level stats subset from GET /{index}/_stats */
export interface IndexStatsData {
  docs?: { count?: number; deleted?: number };
  store?: { size_in_bytes?: number };
  indexing?: { index_total?: number; index_time_in_millis?: number };
  search?: { query_total?: number; query_time_in_millis?: number };
  segments?: { count?: number; memory_in_bytes?: number };
  get?: { total?: number };
  merge?: { total?: number };
  refresh?: { total?: number; total_time_in_millis?: number };
  flush?: { total?: number; total_time_in_millis?: number };
}

/** Response from GET /{index}/_stats */
export interface IndexStatsResponse {
  _shards?: { total?: number; successful?: number; failed?: number };
  _all?: {
    primaries?: IndexStatsData;
    total?: IndexStatsData;
  };
}

/** Storage breakdown for a single field from POST /{index}/_disk_usage */
export interface DiskUsageFieldStats {
  total_in_bytes: number;
  inverted_index?: { total_in_bytes: number };
  stored_fields_in_bytes?: number;
  doc_values_in_bytes?: number;
  points_in_bytes?: number;
  norms_in_bytes?: number;
  term_vectors_in_bytes?: number;
  knn_vectors_in_bytes?: number;
}

/** Per-index entry in the disk usage response */
export interface DiskUsageIndexEntry {
  store_size_in_bytes: number;
  all_fields: DiskUsageFieldStats;
  fields: Record<string, DiskUsageFieldStats>;
}

/** Response from POST /{index}/_disk_usage?run_expensive_tasks=true */
export interface DiskUsageResponse {
  _shards?: { total?: number; successful?: number; failed?: number };
  [index: string]: DiskUsageIndexEntry | DiskUsageResponse["_shards"] | undefined;
}
