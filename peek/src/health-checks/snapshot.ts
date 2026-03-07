import type { ElasticsearchClient } from "../services/es";

import type { HealthQueryGroup, HealthSnapshot } from "./types";

export const HEALTH_SNAPSHOT_TTL_MS = 30_000;

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
      default:
        return { group, data: null };
    }
  } catch (error) {
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

    if (result.group === "clusterCore" && result.data) {
      data.clusterCore = result.data as HealthSnapshot["data"]["clusterCore"];
    }
    if (result.group === "nodesCore" && result.data) {
      data.nodesCore = result.data as HealthSnapshot["data"]["nodesCore"];
    }
    if (result.group === "tasksCore" && result.data) {
      data.tasksCore = result.data as HealthSnapshot["data"]["tasksCore"];
    }
    if (result.group === "ilmCore" && result.data) {
      data.ilmCore = result.data as HealthSnapshot["data"]["ilmCore"];
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    data,
    errors,
  };
}
