import type { HealthCheckDefinition } from "../types";

const LONG_TASK_NANOS = 300_000_000_000; // 5 minutes

/** Well-known persistent/system task action prefixes that run for the cluster lifetime. */
const PERSISTENT_TASK_PREFIXES = [
  "health-node",
  "data_frame/transforms",
  "geoip-downloader",
  "eis-authorization-poller",
  "monitoring/bulk",
  "logstash/pipeline",
  "ml/anomaly_detectors",
  "ml/datafeeds",
  "ml/analytics",
  "enrich/coordinator",
  "rollup/job",
  "ccr/",
  "slm/retention",
  "ilm/move_to_step",
];

function isPersistentSystemTask(task: ClusterTaskInfo): boolean {
  const action = task.action ?? "";
  return PERSISTENT_TASK_PREFIXES.some((prefix) => action.startsWith(prefix));
}

function flattenTasks(tasksCore: TasksListResponse | null | undefined): ClusterTaskInfo[] {
  const nodes = tasksCore?.nodes ?? {};
  return Object.values(nodes).flatMap((node) => Object.values(node.tasks ?? {}));
}

function isVotingOnlyNode(roles: string[] | undefined): boolean {
  return Boolean(roles?.includes("voting_only"));
}

export const INITIAL_HEALTH_CHECKS: HealthCheckDefinition[] = [
  {
    id: "cluster.status.red",
    domain: "cluster",
    title: "Cluster status red",
    description: "Fails when cluster status is red — at least one primary shard is unassigned.",
    severityOnFail: "critical",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cluster-health",
    recommendation:
      "Check for unassigned primary shards and resolve the root cause (disk space, node failures, or allocation settings).",
    evaluate: (snapshot) => {
      const status = snapshot.data.clusterCore?.clusterHealth?.status ?? "unknown";
      if (status === "red") {
        return {
          status: "fail",
          summary: "Cluster health is RED — one or more primary shards are unassigned.",
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
    description:
      "Warns when cluster status is yellow — all primaries are assigned but some replicas are not.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cluster-health",
    recommendation:
      "Check for unassigned replica shards. Common causes include insufficient nodes, disk watermarks, or allocation filters.",
    evaluate: (snapshot) => {
      const status = snapshot.data.clusterCore?.clusterHealth?.status ?? "unknown";
      if (status === "yellow") {
        return {
          status: "warn",
          summary: "Cluster health is YELLOW — all primaries assigned but some replicas are not.",
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
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cluster-allocation-explain",
    recommendation:
      "Run the Cluster Allocation Explain API to determine why shards are unassigned, then address the root cause.",
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
    id: "cluster.delayed_unassigned_shards",
    domain: "cluster",
    title: "Delayed unassigned shards",
    description:
      "Warns when delayed unassigned shards are present — these shards are waiting for a node to rejoin before being reallocated.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/index-settings/delayed-allocation",
    recommendation:
      "Delayed shards are waiting for a departed node to rejoin. If the node will not return, remove the delay with index.unassigned.node_left.delayed_timeout.",
    evaluate: (snapshot) => {
      const delayed = snapshot.data.clusterCore?.clusterHealth?.delayed_unassigned_shards ?? 0;
      if (delayed > 0) {
        return {
          status: "warn",
          summary: `${delayed} delayed unassigned shard${delayed === 1 ? "" : "s"} — waiting for a node to rejoin.`,
          observed: { delayed },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No delayed unassigned shards." };
    },
  },
  {
    id: "cluster.pending_tasks.nonzero",
    domain: "cluster",
    title: "Pending cluster tasks",
    description: "Warns when pending cluster-state update tasks are queued.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cluster-pending-tasks",
    recommendation:
      "A small backlog is normal during heavy indexing. Persistent backlogs may indicate master node pressure — check master node CPU and heap.",
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
    description:
      "Warns when any data/master node JVM heap usage is >= 85%. Voting-only tiebreaker nodes are excluded because their small heaps make high percentages normal.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/jvm-settings",
    recommendation:
      "High heap pressure increases GC pauses and risks OOM kills. Consider increasing heap size (up to 50% of RAM, max ~31 GB) or reducing cache/fielddata usage.",
    evaluate: (snapshot) => {
      const nodes = Object.values(snapshot.data.nodesCore?.nodeStats?.nodes ?? {});
      const eligibleNodes = nodes.filter((node) => !isVotingOnlyNode(node.roles));
      const hottestNode = eligibleNodes
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
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/nodes-stats",
    recommendation:
      "Sustained high CPU may indicate heavy query load, large merges, or insufficient capacity. Check hot threads for root cause.",
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
    description:
      "Warns when circuit breaker trip counters are non-zero. Trips indicate memory pressure that was caught before causing an OutOfMemoryError.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/circuit-breaker-settings",
    recommendation:
      "Review fielddata usage, in-flight request sizes, and aggregation complexity. Consider increasing heap or adding nodes.",
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
    description:
      "Warns when thread pool rejections (write, search, get) are non-zero. Rejections mean work items were dropped because the queue was full.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["nodesCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/thread-pool-settings",
    recommendation:
      "Rejections indicate the cluster cannot keep up with request volume. Scale out, reduce indexing rate, or optimize queries.",
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
    description: "Warns when there are many concurrent running tasks (>= 100).",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/list-tasks",
    recommendation:
      "A high task count may indicate heavy concurrent activity. Check for runaway queries or bulk indexing storms.",
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
    description:
      "Warns when non-persistent tasks exceed 5 minutes. Persistent system tasks (transforms, health-node, geoip-downloader, etc.) are excluded as they run for the cluster lifetime.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/list-tasks",
    recommendation:
      "Long-running non-persistent tasks may be stuck queries or bulk operations. Consider cancelling them if they are not making progress.",
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const longRunning = tasks.filter(
        (task) =>
          Number(task.running_time_in_nanos ?? 0) >= LONG_TASK_NANOS &&
          !isPersistentSystemTask(task),
      );
      if (longRunning.length > 0) {
        return {
          status: "warn",
          summary: `${longRunning.length} long-running task${longRunning.length === 1 ? "" : "s"} detected (excluding persistent system tasks).`,
          observed: {
            longRunning: longRunning.slice(0, 5).map((t) => ({
              action: t.action,
              running_time_in_nanos: t.running_time_in_nanos,
              cancellable: t.cancellable,
            })),
          },
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
    description: "Fails when ILM-managed indices are stuck in a failed step.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["ilmCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/ilm-explain-lifecycle",
    recommendation:
      "Use the ILM Explain API to identify the failed step and error, then fix the root cause and retry the step.",
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
    description: "Fails when ILM-managed indices reference lifecycle policies that do not exist.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["ilmCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/ilm-get-lifecycle",
    recommendation:
      "Recreate the missing ILM policy or reassign affected indices to an existing policy.",
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
