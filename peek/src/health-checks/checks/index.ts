import {
  totalCircuitBreakerTrips,
  totalThreadPoolRejections,
} from "../../components/cluster-health/clusterHealthUtils";
import type { ClusterTaskInfo, TasksListResponse } from "../../services/es";

import type { HealthCheckDefinition } from "../types";

const LONG_TASK_NANOS = 300_000_000_000; // 5 minutes

function flattenTasks(tasksCore: TasksListResponse | null | undefined): ClusterTaskInfo[] {
  const nodes = tasksCore?.nodes ?? {};
  return Object.values(nodes).flatMap((node) => Object.values(node.tasks ?? {}));
}

export const INITIAL_HEALTH_CHECKS: HealthCheckDefinition[] = [
  {
    id: "cluster.status.red",
    domain: "cluster",
    title: "Cluster status red",
    description: "Fails when cluster status is red.",
    severityOnFail: "critical",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const status = snapshot.data.clusterCore?.clusterHealth?.status ?? "unknown";
      if (status === "red") {
        return {
          status: "fail",
          summary: "Cluster health is RED.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: `Cluster status is ${String(status).toUpperCase()}.` };
    },
  },
  {
    id: "cluster.status.yellow",
    domain: "cluster",
    title: "Cluster status yellow",
    description: "Warns when cluster status is yellow.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const status = snapshot.data.clusterCore?.clusterHealth?.status ?? "unknown";
      if (status === "yellow") {
        return {
          status: "warn",
          summary: "Cluster health is YELLOW.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: `Cluster status is ${String(status).toUpperCase()}.` };
    },
  },
  {
    id: "cluster.unassigned_shards",
    domain: "cluster",
    title: "Unassigned shards",
    description: "Fails when unassigned shards are present.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const unassigned = snapshot.data.clusterCore?.clusterHealth?.unassigned_shards ?? 0;
      if (unassigned > 0) {
        return {
          status: "fail",
          summary: `${unassigned} unassigned shard${unassigned === 1 ? "" : "s"} detected.`,
          observed: { unassigned },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No unassigned shards detected." };
    },
  },
  {
    id: "cluster.pending_tasks.nonzero",
    domain: "cluster",
    title: "Pending cluster tasks",
    description: "Warns when pending cluster tasks are queued.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const taskCount = snapshot.data.clusterCore?.pendingTasks?.tasks?.length ?? 0;
      if (taskCount > 0) {
        return {
          status: "warn",
          summary: `${taskCount} pending cluster task${taskCount === 1 ? "" : "s"}.`,
          observed: { taskCount },
          links: [{ label: "Task Backlog", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No pending cluster tasks." };
    },
  },
  {
    id: "nodes.jvm.heap_percent.high",
    domain: "nodes",
    title: "Node heap utilization",
    description: "Warns when any node JVM heap usage is >= 85%.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      const hottestNode = nodes
        .map((node) => ({
          name: node.name ?? "unknown",
          heap: node.jvm?.mem?.heap_used_percent ?? 0,
        }))
        .sort((a, b) => b.heap - a.heap)[0];

      if ((hottestNode?.heap ?? 0) >= 85) {
        return {
          status: "warn",
          summary: `High JVM heap on ${hottestNode?.name} (${hottestNode?.heap}%).`,
          observed: { hottestNode },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }

      return { status: "pass", summary: "Node JVM heap utilization is within threshold." };
    },
  },
  {
    id: "nodes.cpu.percent.high",
    domain: "nodes",
    title: "Node CPU utilization",
    description: "Warns when any node CPU usage is >= 90%.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      const hottestNode = nodes
        .map((node) => ({ name: node.name ?? "unknown", cpu: node.os?.cpu?.percent ?? 0 }))
        .sort((a, b) => b.cpu - a.cpu)[0];

      if ((hottestNode?.cpu ?? 0) >= 90) {
        return {
          status: "warn",
          summary: `High CPU on ${hottestNode?.name} (${hottestNode?.cpu}%).`,
          observed: { hottestNode },
          links: [{ label: "Nodes", to: "/nodes" }],
        };
      }

      return { status: "pass", summary: "Node CPU utilization is within threshold." };
    },
  },
  {
    id: "nodes.breakers.tripped",
    domain: "nodes",
    title: "Circuit breaker trips",
    description: "Warns when breaker trip counters are non-zero.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const totalTrips = totalCircuitBreakerTrips(snapshot.data.nodesCore?.nodeStats?.nodes);
      if (totalTrips > 0) {
        return {
          status: "warn",
          summary: `${totalTrips} circuit breaker trip${totalTrips === 1 ? "" : "s"} reported.`,
          observed: { totalTrips },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No circuit breaker trips reported." };
    },
  },
  {
    id: "nodes.thread_pool.rejected.nonzero",
    domain: "nodes",
    title: "Thread pool rejections",
    description: "Warns when thread pool rejections are non-zero.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    evaluate: (snapshot) => {
      const totalRejected = totalThreadPoolRejections(snapshot.data.nodesCore?.nodeStats?.nodes);
      if (totalRejected > 0) {
        return {
          status: "warn",
          summary: `${totalRejected} thread pool rejection${totalRejected === 1 ? "" : "s"} reported.`,
          observed: { totalRejected },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No thread pool rejections reported." };
    },
  },
  {
    id: "tasks.running.count.high",
    domain: "tasks",
    title: "Running task count",
    description: "Warns when there are many concurrent running tasks.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      if (tasks.length >= 100) {
        return {
          status: "warn",
          summary: `${tasks.length} tasks are currently running.`,
          observed: { taskCount: tasks.length },
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: `${tasks.length} running tasks (within threshold).` };
    },
  },
  {
    id: "tasks.long_running.absolute",
    domain: "tasks",
    title: "Long-running tasks",
    description: "Fails when tasks exceed the absolute runtime threshold.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const longRunning = tasks.filter(
        (task) => Number(task.running_time_in_nanos ?? 0) >= LONG_TASK_NANOS,
      );
      if (longRunning.length > 0) {
        return {
          status: "fail",
          summary: `${longRunning.length} long-running task${longRunning.length === 1 ? "" : "s"} detected.`,
          observed: { longRunning: longRunning.slice(0, 5) },
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No long-running tasks beyond threshold." };
    },
  },
  {
    id: "ilm.indices.error",
    domain: "ilm",
    title: "ILM indices in error",
    description: "Fails when ILM-managed indices are in a failed step.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["ilmCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.ilmCore?.ilmExplain?.indices ?? {};
      const failed = Object.entries(indices)
        .filter(([, entry]) => Boolean(entry.failed_step))
        .map(([index, entry]) => ({ index, failedStep: entry.failed_step }));

      if (failed.length > 0) {
        return {
          status: "fail",
          summary: `${failed.length} ILM index${failed.length === 1 ? "" : "es"} in failed state.`,
          observed: { failed: failed.slice(0, 10) },
          links: [{ label: "Resilience", to: "/cluster-resilience" }],
        };
      }
      return { status: "pass", summary: "No ILM indices in failed steps." };
    },
  },
  {
    id: "ilm.policy.missing_or_invalid",
    domain: "ilm",
    title: "ILM missing policies",
    description: "Fails when ILM-managed indices reference missing lifecycle policies.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["ilmCore"],
    evaluate: (snapshot) => {
      const indices = snapshot.data.ilmCore?.ilmExplain?.indices ?? {};
      const policyNames = new Set(Object.keys(snapshot.data.ilmCore?.ilmPolicies ?? {}));
      const missing = Object.entries(indices)
        .filter(
          ([, entry]) => entry.managed && Boolean(entry.policy) && !policyNames.has(entry.policy!),
        )
        .map(([index, entry]) => ({ index, policy: entry.policy }));

      if (missing.length > 0) {
        return {
          status: "fail",
          summary: `${missing.length} index${missing.length === 1 ? "" : "es"} reference missing ILM policies.`,
          observed: { missing: missing.slice(0, 10) },
          links: [{ label: "Resilience", to: "/cluster-resilience" }],
        };
      }
      return { status: "pass", summary: "All ILM-managed indices reference existing policies." };
    },
  },
];
