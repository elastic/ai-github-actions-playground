import type { HealthCheckDefinition } from "../types";

export const clusterChecks: HealthCheckDefinition[] = [
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
    id: "cluster.unassigned_primaries",
    domain: "cluster",
    title: "Unassigned primary shards",
    description:
      "Fails when unassigned primary shards are present — data loss may occur until these are recovered.",
    severityOnFail: "critical",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cluster-allocation-explain",
    recommendation:
      "Unassigned primaries cause data unavailability. Check node health, disk space, and run allocation explain.",
    evaluate: (snapshot) => {
      const h = snapshot.data.clusterCore?.clusterHealth;
      const count = (h as Record<string, unknown>)?.unassigned_primary_shards as number | undefined ?? 0;
      if (count > 0) {
        return {
          status: "fail",
          summary: `${count} unassigned primary shard${count === 1 ? "" : "s"} — data may be unavailable.`,
          observed: { unassignedPrimaries: count },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No unassigned primary shards." };
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
      const delayed =
        snapshot.data.clusterCore?.clusterHealth?.delayed_unassigned_shards ?? 0;
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
    id: "cluster.initializing_shards.high",
    domain: "cluster",
    title: "Initializing shards",
    description: "Warns when many shards are initializing, which may indicate recovery in progress.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cluster-health",
    recommendation:
      "Initializing shards are normal during recovery. If the count persists, check for slow recovery or node issues.",
    evaluate: (snapshot) => {
      const count = snapshot.data.clusterCore?.clusterHealth?.initializing_shards ?? 0;
      if (count >= 5) {
        return {
          status: "warn",
          summary: `${count} shard${count === 1 ? "" : "s"} initializing — recovery in progress.`,
          observed: { initializingShards: count },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No significant shard initialization activity." };
    },
  },
  {
    id: "cluster.relocating_shards.high",
    domain: "cluster",
    title: "Relocating shards",
    description: "Warns when many shards are relocating between nodes.",
    severityOnFail: "low",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cluster-health",
    recommendation:
      "Shard relocation is normal after node changes. High counts during steady state may indicate frequent rebalancing.",
    evaluate: (snapshot) => {
      const count = snapshot.data.clusterCore?.clusterHealth?.relocating_shards ?? 0;
      if (count >= 5) {
        return {
          status: "warn",
          summary: `${count} shard${count === 1 ? "" : "s"} relocating between nodes.`,
          observed: { relocatingShards: count },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No significant shard relocation activity." };
    },
  },
  {
    id: "cluster.active_shards_percent.low",
    domain: "cluster",
    title: "Active shards percentage",
    description: "Warns when the percentage of active shards drops below 100%.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cluster-health",
    recommendation:
      "Less than 100% active shards means some shards are unassigned, initializing, or relocating. Investigate the root cause.",
    evaluate: (snapshot) => {
      const pct = snapshot.data.clusterCore?.clusterHealth?.active_shards_percent_as_number ?? 100;
      if (pct < 100) {
        return {
          status: "warn",
          summary: `Only ${pct.toFixed(1)}% of shards are active.`,
          observed: { activeShardsPercent: pct },
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "100% of shards are active." };
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
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cluster-pending-tasks",
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
    id: "cluster.pending_tasks.high",
    domain: "cluster",
    title: "Pending task backlog",
    description: "Fails when pending cluster tasks exceed a critical threshold (>= 50).",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["clusterCore"],
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cluster-pending-tasks",
    recommendation:
      "A large pending task backlog means the master node cannot keep up. Check master CPU/heap, reduce cluster state churn, or add dedicated masters.",
    evaluate: (snapshot) => {
      const tasks = snapshot.data.clusterCore?.pendingTasks?.tasks ?? [];
      if (tasks.length >= 50) {
        return {
          status: "fail",
          summary: `${tasks.length} pending cluster tasks — master node may be overwhelmed.`,
          observed: { taskCount: tasks.length },
          links: [{ label: "Task Backlog", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "Pending task backlog is manageable." };
    },
  },
  {
    id: "cluster.pending_tasks.oldest_wait.high",
    domain: "cluster",
    title: "Pending task queue time",
    description: "Warns when the oldest pending task has been waiting more than 30 seconds.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["clusterCore"],
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cluster-pending-tasks",
    recommendation:
      "Long queue times indicate master node contention. Check for expensive mapping updates or heavy ILM activity.",
    evaluate: (snapshot) => {
      const tasks = snapshot.data.clusterCore?.pendingTasks?.tasks ?? [];
      const maxWait = Math.max(0, ...tasks.map((t) => t.time_in_queue_millis ?? 0));
      if (maxWait >= 30_000) {
        return {
          status: "warn",
          summary: `Oldest pending task has been queued for ${(maxWait / 1000).toFixed(0)}s.`,
          observed: { maxWaitMs: maxWait },
          links: [{ label: "Task Backlog", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No excessive pending task queue times." };
    },
  },
  {
    id: "cluster.pending_tasks.priority.urgent",
    domain: "cluster",
    title: "Urgent pending tasks",
    description: "Warns when urgent or immediate priority pending tasks are present.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["clusterCore"],
    docsUrl:
      "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cluster-pending-tasks",
    recommendation:
      "Urgent pending tasks typically indicate critical operations like shard allocation or master election. Investigate immediately.",
    evaluate: (snapshot) => {
      const tasks = snapshot.data.clusterCore?.pendingTasks?.tasks ?? [];
      const urgent = tasks.filter(
        (t) => t.priority === "URGENT" || t.priority === "IMMEDIATE",
      );
      if (urgent.length > 0) {
        return {
          status: "warn",
          summary: `${urgent.length} urgent/immediate pending task${urgent.length === 1 ? "" : "s"}.`,
          observed: {
            urgentTasks: urgent.slice(0, 5).map((t) => ({
              priority: t.priority,
              source: t.source,
              waitMs: t.time_in_queue_millis,
            })),
          },
          links: [{ label: "Task Backlog", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No urgent pending tasks." };
    },
  },
];
