import type { ElasticsearchClient } from "../services/es";

import type { HealthQueryGroup, HealthSnapshot } from "./types";

export const HEALTH_SNAPSHOT_TTL_MS = 30_000;

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error) {
    return error.name === "AbortError" || error.name === "CanceledError";
  }
  return false;
}

async function fetchGroup(
  client: ElasticsearchClient,
  group: HealthQueryGroup,
  signal?: AbortSignal,
): Promise<{ group: HealthQueryGroup; data?: unknown; error?: string }> {
  try {
    switch (group) {
      case "clusterCore": {
        const [clusterHealth, pendingTasks] = await Promise.all([
          client.getClusterHealth("indices", signal),
          client.getPendingTasks(signal),
        ]);
        return { group, data: { clusterHealth, pendingTasks } };
      }
      case "nodesCore": {
        const nodeStats = await client.getNodeStats(signal);
        return { group, data: { nodeStats } };
      }
      case "tasksCore": {
        const tasks = await client.getTasksDetailed(signal);
        return { group, data: { tasks } };
      }
      case "ilmCore": {
        const [ilmExplain, ilmPolicies] = await Promise.all([
          client.getIlmExplainAll(signal),
          client.getIlmPolicies(signal),
        ]);
        return { group, data: { ilmExplain, ilmPolicies } };
      }
      case "shards": {
        const catShards = await client.getCatShards(signal);
        return { group, data: { catShards } };
      }
      case "allocationSample": {
        try {
          const allocationExplain = await client.getAllocationExplain(signal);
          return { group, data: { allocationExplain } };
        } catch (innerError) {
          if (isAbortError(innerError) || signal?.aborted) throw innerError;
          const status =
            typeof innerError === "object" && innerError !== null && "status" in innerError
              ? Number((innerError as { status?: unknown }).status)
              : undefined;
          if (status === 400) {
            // 400 when no unassigned shards exist — treat as empty
            return { group, data: { allocationExplain: null } };
          }
          throw innerError;
        }
      }
      case "indicesCore": {
        const catIndices = await client.getCatIndices(signal);
        return { group, data: { catIndices } };
      }
      case "recoveryCore": {
        const recovery = await client.getRecoveryStatus(signal);
        return { group, data: { recovery } };
      }
      case "securityCore": {
        const apiKeys = await client.getApiKeys(signal);
        return { group, data: { apiKeys } };
      }
      case "transformsCore": {
        try {
          const transformStats = await client.getTransformStats(signal);
          return { group, data: { transformStats } };
        } catch (innerError) {
          if (isAbortError(innerError) || signal?.aborted) throw innerError;
          const status =
            typeof innerError === "object" && innerError !== null && "status" in innerError
              ? Number((innerError as { status?: unknown }).status)
              : undefined;
          // 404 when transforms feature is not available on the cluster
          if (status === 404 || status === 400) {
            return { group, data: { transformStats: { count: 0, transforms: [] } } };
          }
          throw innerError;
        }
      }
      default:
        return { group, data: null };
    }
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      throw error;
    }
    return {
      group,
      error: error instanceof Error ? error.message : `Failed to load ${group}`,
    };
  }
}

export async function buildHealthSnapshot(
  client: ElasticsearchClient,
  groups: HealthQueryGroup[],
  signal?: AbortSignal,
): Promise<HealthSnapshot> {
  const uniqueGroups = Array.from(new Set(groups));
  const groupResults = await Promise.all(
    uniqueGroups.map((group) => fetchGroup(client, group, signal)),
  );

  const data: HealthSnapshot["data"] = {};
  const errors: HealthSnapshot["errors"] = {};

  for (const result of groupResults) {
    if (result.error) {
      errors[result.group] = result.error;
      continue;
    }

    if (result.data != null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic group assignment
      (data as any)[result.group] = result.data;
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    data,
    errors,
  };
}
