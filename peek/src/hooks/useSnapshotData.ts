import { useQuery } from "@tanstack/react-query";

import type {
  GetSnapshotsResponse,
  GetRepositoriesResponse,
  GetSlmPoliciesResponse,
  SlmStatsResponse,
  SnapshotRecord,
  SlmPolicyRecord,
  SnapshotRepository,
} from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

// ---------------------------------------------------------------------------
// Processed row types used by the page component
// ---------------------------------------------------------------------------

export interface SnapshotRow {
  name: string;
  repository: string;
  state: string;
  indexCount: number;
  dataStreamCount: number;
  startTime: string;
  startTimeMs: number;
  endTime: string;
  duration: number;
  indices: string[];
  dataStreams: string[];
}

export interface SlmPolicyRow {
  name: string;
  repository: string;
  schedule: string;
  nextExecutionMs: number;
  snapshotsTaken: number;
  snapshotsFailed: number;
  snapshotsDeleted: number;
  deletionFailures: number;
  lastSuccessTime: number;
  lastSuccessName: string;
  lastFailureTime: number;
  lastFailureDetails: string;
  expireAfter: string;
  minCount: number;
  maxCount: number;
  indices: string[];
  isFailing: boolean;
}

export interface RepositoryRow {
  name: string;
  type: string;
  settings: Record<string, string>;
}

export interface SnapshotData {
  snapshots: SnapshotRow[];
  policies: SlmPolicyRow[];
  repositories: RepositoryRow[];
  slmStats: SlmStatsResponse | null;
}

// ---------------------------------------------------------------------------
// Transform helpers
// ---------------------------------------------------------------------------

function toSnapshotRows(records: SnapshotRecord[]): SnapshotRow[] {
  return records.map((r) => ({
    name: r.snapshot ?? "",
    repository: r.repository ?? "",
    state: r.state ?? "UNKNOWN",
    indexCount: r.indices?.length ?? 0,
    dataStreamCount: r.data_streams?.length ?? 0,
    startTime: r.start_time ?? "",
    startTimeMs: r.start_time_in_millis ?? 0,
    endTime: r.end_time ?? "",
    duration: r.duration_in_millis ?? 0,
    indices: r.indices ?? [],
    dataStreams: r.data_streams ?? [],
  }));
}

function toSlmPolicyRows(policies: Record<string, SlmPolicyRecord>): SlmPolicyRow[] {
  return Object.entries(policies).map(([name, record]) => {
    const lastSuccessTime = record.last_success?.time ?? 0;
    const lastFailureTime = record.last_failure?.time ?? 0;
    return {
      name,
      repository: record.policy?.repository ?? "",
      schedule: record.policy?.schedule ?? "",
      nextExecutionMs: record.next_execution_millis ?? 0,
      snapshotsTaken: record.stats?.snapshots_taken ?? 0,
      snapshotsFailed: record.stats?.snapshots_failed ?? 0,
      snapshotsDeleted: record.stats?.snapshots_deleted ?? 0,
      deletionFailures: record.stats?.snapshot_deletion_failures ?? 0,
      lastSuccessTime,
      lastSuccessName: record.last_success?.snapshot_name ?? "",
      lastFailureTime,
      lastFailureDetails: record.last_failure?.details ?? "",
      expireAfter: record.policy?.retention?.expire_after ?? "",
      minCount: record.policy?.retention?.min_count ?? 0,
      maxCount: record.policy?.retention?.max_count ?? 0,
      indices: record.policy?.config?.indices ?? [],
      isFailing: lastFailureTime > lastSuccessTime,
    };
  });
}

function toRepositoryRows(repos: Record<string, SnapshotRepository>): RepositoryRow[] {
  return Object.entries(repos).map(([name, repo]) => ({
    name,
    type: repo.type ?? "unknown",
    settings: repo.settings ?? {},
  }));
}

interface RawSnapshotData {
  snapshots: GetSnapshotsResponse;
  policies: GetSlmPoliciesResponse;
  repositories: GetRepositoriesResponse;
  slmStats: SlmStatsResponse;
}

function toSnapshotData(raw: RawSnapshotData): SnapshotData {
  return {
    snapshots: toSnapshotRows(raw.snapshots.snapshots ?? []),
    policies: toSlmPolicyRows(raw.policies),
    repositories: toRepositoryRows(raw.repositories),
    slmStats: raw.slmStats,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSnapshotData(): DataFetchResult<SnapshotData> & { refresh: () => void } {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["snapshots", connection?.url],
    queryFn: createQueryFn(async (client) => {
      const [snapshots, policies, repositories, slmStats] = await Promise.allSettled([
        client.getSnapshots(),
        client.getSlmPolicies(),
        client.getRepositories(),
        client.getSlmStats(),
      ]);
      return {
        snapshots: snapshots.status === "fulfilled" ? snapshots.value : { snapshots: [] },
        policies: policies.status === "fulfilled" ? policies.value : {},
        repositories: repositories.status === "fulfilled" ? repositories.value : {},
        slmStats: slmStats.status === "fulfilled" ? slmStats.value : ({} as SlmStatsResponse),
      } satisfies RawSnapshotData;
    }),
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    select: toSnapshotData,
  });
  useRefetchOnConnectionChange(connection, query.refetch);

  const refresh = () => {
    void query.refetch();
  };

  if (!connection) return { status: "idle", refresh };
  if (query.isFetching) return { status: "loading", refresh };
  if (query.isError) return { status: "error", error: query.error.message, refresh };
  if (query.data) return { status: "success", data: query.data, refresh };
  return { status: "idle", refresh };
}
