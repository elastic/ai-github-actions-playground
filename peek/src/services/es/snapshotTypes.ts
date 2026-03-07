// ---------------------------------------------------------------------------
// Snapshot, SLM, and Repository types
// ---------------------------------------------------------------------------

/** A single snapshot record returned by the snapshots API */
export interface SnapshotRecord {
  snapshot?: string;
  repository?: string;
  state?: "SUCCESS" | "PARTIAL" | "FAILED" | "IN_PROGRESS" | "INCOMPATIBLE";
  indices?: string[];
  data_streams?: string[];
  start_time?: string;
  start_time_in_millis?: number;
  end_time?: string;
  end_time_in_millis?: number;
  duration_in_millis?: number;
}

/** Response from the list snapshots API */
export interface GetSnapshotsResponse {
  snapshots?: SnapshotRecord[];
}

/** A single snapshot repository from GET /_snapshot */
export interface SnapshotRepository {
  type?: string;
  settings?: Record<string, string>;
}

/** Response from GET /_snapshot */
export type GetRepositoriesResponse = Record<string, SnapshotRepository>;

/** SLM policy retention configuration */
export interface SlmRetention {
  expire_after?: string;
  min_count?: number;
  max_count?: number;
}

/** SLM policy configuration */
export interface SlmPolicyConfig {
  name?: string;
  repository?: string;
  schedule?: string;
  config?: {
    indices?: string[];
    include_global_state?: boolean;
    ignore_unavailable?: boolean;
  };
  retention?: SlmRetention;
}

/** Per-policy stats */
export interface SlmPolicyStatsDetail {
  policy?: string;
  snapshots_taken?: number;
  snapshots_failed?: number;
  snapshots_deleted?: number;
  snapshot_deletion_failures?: number;
}

/** SLM policy record from GET /_slm/policy?human */
export interface SlmPolicyRecord {
  version?: number;
  modified_date_millis?: number;
  policy?: SlmPolicyConfig;
  last_success?: {
    snapshot_name?: string;
    time?: number;
  };
  last_failure?: {
    snapshot_name?: string;
    details?: string;
    time?: number;
  };
  next_execution_millis?: number;
  stats?: SlmPolicyStatsDetail;
}

/** Response from GET /_slm/policy?human */
export type GetSlmPoliciesResponse = Record<string, SlmPolicyRecord>;

/** Searchable snapshots cache stats per node */
export interface SearchableSnapshotsCacheNodeStats {
  shared_cache?: {
    reads?: number;
    bytes_read_in_bytes?: number;
    writes?: number;
    bytes_written_in_bytes?: number;
    evictions?: number;
    num_regions?: number;
    size_in_bytes?: number;
    region_size_in_bytes?: number;
  };
}

/** Response from GET /_searchable_snapshots/cache/stats */
export interface GetSearchableSnapshotsCacheStatsResponse {
  nodes?: Record<string, SearchableSnapshotsCacheNodeStats>;
}
