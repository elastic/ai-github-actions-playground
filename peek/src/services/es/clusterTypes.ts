import type { operations } from "./types.generated";

// ---------------------------------------------------------------------------
// Cluster types — health, stats, nodes, allocation, recovery, ILM, SLM, etc.
// ---------------------------------------------------------------------------

/** Response from GET / (cluster info) */
export type ClusterInfoResponse =
  operations["info"]["responses"][200]["content"]["application/json"];

export interface ClusterHealthResponse {
  cluster_name?: string;
  status?: "green" | "yellow" | "red";
  timed_out?: boolean;
  number_of_nodes?: number;
  number_of_data_nodes?: number;
  active_primary_shards?: number;
  active_shards?: number;
  initializing_shards?: number;
  relocating_shards?: number;
  delayed_unassigned_shards?: number;
  unassigned_shards?: number;
  number_of_in_flight_fetch?: number;
  active_shards_percent_as_number?: number;
}

export interface ClusterPendingTask {
  insert_order?: number;
  priority?: string;
  source?: string;
  time_in_queue_millis?: number;
}

export interface ClusterPendingTasksResponse {
  tasks?: ClusterPendingTask[];
}

export interface CatAllocationRecord {
  node?: string;
  shards?: string;
  "disk.indices"?: string;
  "disk.used"?: string;
  "disk.avail"?: string;
  "disk.percent"?: string;
}

export interface CatShardRecord {
  index?: string;
  shard?: string;
  prirep?: string;
  state?: string;
  docs?: string;
  store?: string;
  node?: string;
  "unassigned.reason"?: string;
}

export interface ClusterStatsResponse {
  indices?: {
    count?: number;
    shards?: { total?: number };
    docs?: { count?: number };
    store?: { size_in_bytes?: number };
  };
  nodes?: {
    count?: { total?: number };
  };
}

export interface NodesInfoNode {
  name?: string;
  roles?: string[];
  version?: string;
}

export interface NodesInfoResponse {
  nodes?: Record<string, NodesInfoNode>;
}

export interface NodeStatsNode {
  name?: string;
  os?: {
    cpu?: {
      percent?: number;
      load_average?: { "1m"?: number; "5m"?: number; "15m"?: number };
    };
    mem?: { used_percent?: number; total_in_bytes?: number; free_in_bytes?: number };
  };
  jvm?: {
    mem?: { heap_used_percent?: number };
    gc?: {
      collectors?: {
        young?: { collection_count?: number; collection_time_in_millis?: number };
        old?: { collection_count?: number; collection_time_in_millis?: number };
      };
    };
  };
  fs?: { total?: { total_in_bytes?: number; available_in_bytes?: number } };
  indices?: {
    docs?: { count?: number };
    shard_stats?: { total_count?: number };
    indexing?: { index_total?: number };
    search?: { query_total?: number; query_time_in_millis?: number };
  };
  thread_pool?: Record<
    string,
    { active?: number; rejected?: number; completed?: number; queue?: number }
  >;
  breakers?: Record<
    string,
    { limit_size_in_bytes?: number; estimated_size_in_bytes?: number; tripped?: number }
  >;
  process?: { open_file_descriptors?: number; max_file_descriptors?: number };
  ingest?: { total?: { count?: number; failed?: number; time_in_millis?: number } };
}

export interface NodesStatsResponse {
  nodes?: Record<string, NodeStatsNode>;
}

export interface RecoveryShardStatus {
  stage?: string;
}

export type RecoveryResponse = Record<string, { shards?: RecoveryShardStatus[] }>;

export interface IlmExplainIndexStatus {
  managed?: boolean;
  phase?: string;
  action?: string;
  step?: string;
  failed_step?: string;
}

export interface IlmExplainResponse {
  indices?: Record<string, IlmExplainIndexStatus>;
}

export interface SlmPolicyStats {
  policy?: string;
  snapshots_taken?: number;
  snapshots_failed?: number;
}

export interface SlmStatsResponse {
  operation_mode?: string;
  policy_stats?: SlmPolicyStats[];
}

export interface SnapshotShardStats {
  failed?: number;
  total?: number;
}

export interface SnapshotStatusRecord {
  state?: string;
  shards_stats?: SnapshotShardStats;
}

export interface SnapshotStatusResponse {
  snapshots?: SnapshotStatusRecord[];
}

export interface NodesIngestPipelineStats {
  failed?: number;
  count?: number;
}

export interface NodesIngestNodeStats {
  ingest?: {
    total?: NodesIngestPipelineStats;
    pipelines?: Record<string, NodesIngestPipelineStats>;
  };
}

export interface NodesIngestStatsResponse {
  nodes?: Record<string, NodesIngestNodeStats>;
}

export interface ClusterSettingsResponse {
  persistent?: Record<string, unknown>;
  transient?: Record<string, unknown>;
  defaults?: Record<string, unknown>;
}

export interface ClusterAllocationExplainResponse {
  index?: string;
  shard?: number;
  primary?: boolean;
  current_state?: string;
  unassigned_info?: { reason?: string; at?: string; details?: string };
  can_allocate?: string;
  allocate_explanation?: string;
  node_allocation_decisions?: Array<{
    node_name?: string;
    node_decision?: string;
    deciders?: Array<{ decider?: string; decision?: string; explanation?: string }>;
  }>;
}
