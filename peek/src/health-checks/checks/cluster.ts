import type { HealthCheckDefinition } from "../types";

const INITIALIZING_SHARDS_THRESHOLD = 5;
const RELOCATING_SHARDS_THRESHOLD = 5;
const PENDING_TASKS_HIGH = 10;
const PENDING_TASKS_OLDEST_WAIT_MS = 30_000;
const PENDING_TASKS_ILM_HEAVY = 5;
const PENDING_TASKS_MAPPING_HEAVY = 5;
const PENDING_TASKS_SHARD_STARTED_BACKLOG = 10;
const ACTIVE_SHARDS_PERCENT_THRESHOLD = 100;
const IN_FLIGHT_FETCH_HIGH = 10;

function unknownClusterDataResult() {
  return {
    status: "unknown" as const,
    summary: "Cluster health unknown.",
    recommendation: "Ensure cluster health data is collected and retry the health snapshot.",
    links: [{ label: "Cluster Health", to: "/cluster-health" }],
  };
}

export const clusterChecks: HealthCheckDefinition[] = [
  // #1
  {
    id: "cluster.status.red",
    domain: "cluster",
    title: "Cluster status red",
    description: "Fails when cluster status is red.",
    severityOnFail: "critical",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const status = snapshot.data.clusterCore?.clusterHealth?.status;
      if (!status) {
        return {
          ...unknownClusterDataResult(),
          observed: { status },
        };
      }
      if (status === "red") {
        return {
          status: "fail",
          summary: "Cluster health is RED.",
          observed: { status },
          recommendation: "Investigate unassigned primary shards immediately.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: `Cluster status is ${String(status).toUpperCase()}.` };
    },
  },
  // #2
  {
    id: "cluster.status.yellow",
    domain: "cluster",
    title: "Cluster status yellow",
    description: "Warns when cluster status is yellow.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const status = snapshot.data.clusterCore?.clusterHealth?.status;
      if (!status) {
        return {
          ...unknownClusterDataResult(),
          observed: { status },
        };
      }
      if (status === "yellow") {
        return {
          status: "warn",
          summary: "Cluster health is YELLOW.",
          observed: { status },
          recommendation: "Check for unassigned replica shards.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: `Cluster status is ${String(status).toUpperCase()}.` };
    },
  },
  // #3
  {
    id: "cluster.unassigned_shards.nonzero",
    domain: "cluster",
    title: "Unassigned shards",
    description: "Fails when unassigned shards are present.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const clusterHealth = snapshot.data.clusterCore?.clusterHealth;
      if (!clusterHealth) return unknownClusterDataResult();
      const unassigned = clusterHealth.unassigned_shards ?? 0;
      if (unassigned > 0) {
        return {
          status: "fail",
          summary: `${unassigned} unassigned shard${unassigned === 1 ? "" : "s"} detected.`,
          observed: { unassigned_shards: unassigned },
          recommendation: "Run allocation explain to diagnose why shards are unassigned.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No unassigned shards detected." };
    },
  },
  // #4
  {
    id: "cluster.unassigned_primaries.nonzero",
    domain: "cluster",
    title: "Unassigned primary shards",
    description: "Fails when unassigned primary shards are present.",
    severityOnFail: "critical",
    surfaces: ["global", "local"],
    dependsOn: ["shards"],
    evaluate: (snapshot) => {
      const shards = snapshot.data.shards?.catShards ?? [];
      const unassignedPrimaries = shards.filter(
        (s) => s.state === "UNASSIGNED" && s.prirep === "p",
      );
      if (unassignedPrimaries.length > 0) {
        return {
          status: "fail",
          summary: `${unassignedPrimaries.length} unassigned primary shard${unassignedPrimaries.length === 1 ? "" : "s"} detected.`,
          observed: { unassigned_primary_shards: unassignedPrimaries.length },
          recommendation:
            "Unassigned primaries cause data unavailability. Investigate immediately.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "No unassigned primary shards." };
    },
  },
  // #5
  {
    id: "cluster.initializing_shards.high",
    domain: "cluster",
    title: "Initializing shards high",
    description: "Warns when initializing shards count is above threshold.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const clusterHealth = snapshot.data.clusterCore?.clusterHealth;
      if (!clusterHealth) return unknownClusterDataResult();
      const initializing = clusterHealth.initializing_shards ?? 0;
      if (initializing >= INITIALIZING_SHARDS_THRESHOLD) {
        return {
          status: "warn",
          summary: `${initializing} initializing shard${initializing === 1 ? "" : "s"} detected.`,
          observed: { initializing_shards: initializing, threshold: INITIALIZING_SHARDS_THRESHOLD },
          recommendation:
            "Many initializing shards may indicate ongoing recovery or allocation issues.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: `Initializing shards (${initializing}) within threshold.` };
    },
  },
  // #6
  {
    id: "cluster.relocating_shards.high",
    domain: "cluster",
    title: "Relocating shards high",
    description: "Warns when relocating shards count is above threshold.",
    severityOnFail: "medium",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const clusterHealth = snapshot.data.clusterCore?.clusterHealth;
      if (!clusterHealth) return unknownClusterDataResult();
      const relocating = clusterHealth.relocating_shards ?? 0;
      if (relocating >= RELOCATING_SHARDS_THRESHOLD) {
        return {
          status: "warn",
          summary: `${relocating} relocating shard${relocating === 1 ? "" : "s"} detected.`,
          observed: { relocating_shards: relocating, threshold: RELOCATING_SHARDS_THRESHOLD },
          recommendation: "High shard relocation may impact cluster performance.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: `Relocating shards (${relocating}) within threshold.` };
    },
  },
  // #7
  {
    id: "cluster.active_shards_percent.low",
    domain: "cluster",
    title: "Active shards percent low",
    description: "Warns when active shards percentage drops below threshold.",
    severityOnFail: "high",
    surfaces: ["global", "local"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const percent = snapshot.data.clusterCore?.clusterHealth?.active_shards_percent_as_number;
      if (percent != null && percent < ACTIVE_SHARDS_PERCENT_THRESHOLD) {
        return {
          status: "warn",
          summary: `Active shards percentage is ${percent.toFixed(1)}%.`,
          observed: {
            active_shards_percent: percent,
            threshold: ACTIVE_SHARDS_PERCENT_THRESHOLD,
          },
          recommendation:
            "Some shards are not active. Check for unassigned or initializing shards.",
          links: [{ label: "Cluster Health", to: "/cluster-health" }],
        };
      }
      return { status: "pass", summary: "All shards are active." };
    },
  },
  // #8
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
          observed: { pending_task_count: taskCount },
          recommendation: "Pending tasks may indicate master node pressure.",
          links: [{ label: "Task Backlog", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No pending cluster tasks." };
    },
  },
  // #9
  {
    id: "cluster.pending_tasks.high",
    domain: "cluster",
    title: "High pending task count",
    description: `Warns when pending cluster tasks >= ${PENDING_TASKS_HIGH}.`,
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const tasks = snapshot.data.clusterCore?.pendingTasks?.tasks ?? [];
      if (tasks.length >= PENDING_TASKS_HIGH) {
        return {
          status: "warn",
          summary: `${tasks.length} pending cluster tasks (threshold: ${PENDING_TASKS_HIGH}).`,
          observed: { count: tasks.length, threshold: PENDING_TASKS_HIGH },
          recommendation: "Investigate cluster master stability and task throughput.",
          links: [{ label: "Task Backlog", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: `Pending tasks (${tasks.length}) within threshold.` };
    },
  },
  // #10
  {
    id: "cluster.pending_tasks.oldest_wait.high",
    domain: "cluster",
    title: "Pending task wait time high",
    description: `Warns when the oldest pending task has waited >= ${PENDING_TASKS_OLDEST_WAIT_MS}ms.`,
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const tasks = snapshot.data.clusterCore?.pendingTasks?.tasks ?? [];
      const maxWait = Math.max(0, ...tasks.map((t) => t.time_in_queue_millis ?? 0));
      if (maxWait >= PENDING_TASKS_OLDEST_WAIT_MS) {
        return {
          status: "warn",
          summary: `Oldest pending task waiting ${maxWait}ms.`,
          observed: { maxWaitMs: maxWait, threshold: PENDING_TASKS_OLDEST_WAIT_MS },
          recommendation: "Check for master node overload or long-running cluster state updates.",
        };
      }
      return {
        status: "pass",
        summary: `Oldest pending task wait (${maxWait}ms) within threshold.`,
      };
    },
  },
  // #11
  {
    id: "cluster.pending_tasks.priority.urgent",
    domain: "cluster",
    title: "Urgent pending tasks",
    description: "Fails when URGENT or IMMEDIATE priority pending tasks exist.",
    severityOnFail: "critical",
    surfaces: ["global"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const tasks = snapshot.data.clusterCore?.pendingTasks?.tasks ?? [];
      const urgent = tasks.filter((t) => {
        const p = (t.priority ?? "").toUpperCase();
        return p === "URGENT" || p === "IMMEDIATE";
      });
      if (urgent.length > 0) {
        return {
          status: "fail",
          summary: `${urgent.length} urgent/immediate pending task${urgent.length === 1 ? "" : "s"}.`,
          observed: { count: urgent.length },
          recommendation: "Urgent tasks indicate critical cluster operations are queued.",
        };
      }
      return { status: "pass", summary: "No urgent pending tasks." };
    },
  },
  // #12
  {
    id: "cluster.pending_tasks.source.ilm_heavy",
    domain: "cluster",
    title: "ILM-heavy pending tasks",
    description: `Warns when >= ${PENDING_TASKS_ILM_HEAVY} pending tasks have ILM-related sources.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const tasks = snapshot.data.clusterCore?.pendingTasks?.tasks ?? [];
      const ilmTasks = tasks.filter((t) => (t.source ?? "").toLowerCase().includes("ilm"));
      if (ilmTasks.length >= PENDING_TASKS_ILM_HEAVY) {
        return {
          status: "warn",
          summary: `${ilmTasks.length} ILM-related pending tasks.`,
          observed: { count: ilmTasks.length },
          recommendation: "ILM operations may be overwhelming the master node.",
        };
      }
      return {
        status: "pass",
        summary: `ILM pending tasks (${ilmTasks.length}) within threshold.`,
      };
    },
  },
  // #13
  {
    id: "cluster.pending_tasks.source.mapping_heavy",
    domain: "cluster",
    title: "Mapping-heavy pending tasks",
    description: `Warns when >= ${PENDING_TASKS_MAPPING_HEAVY} pending tasks are mapping updates.`,
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const tasks = snapshot.data.clusterCore?.pendingTasks?.tasks ?? [];
      const mappingTasks = tasks.filter((t) =>
        (t.source ?? "").toLowerCase().includes("put-mapping"),
      );
      if (mappingTasks.length >= PENDING_TASKS_MAPPING_HEAVY) {
        return {
          status: "warn",
          summary: `${mappingTasks.length} mapping-update pending tasks.`,
          observed: { count: mappingTasks.length },
          recommendation: "Frequent mapping updates can cause master instability.",
        };
      }
      return {
        status: "pass",
        summary: `Mapping pending tasks (${mappingTasks.length}) within threshold.`,
      };
    },
  },
  // #14
  {
    id: "cluster.pending_tasks.source.shard_started_backlog",
    domain: "cluster",
    title: "Shard-started task backlog",
    description: `Warns when >= ${PENDING_TASKS_SHARD_STARTED_BACKLOG} pending shard-started tasks exist.`,
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const tasks = snapshot.data.clusterCore?.pendingTasks?.tasks ?? [];
      const shardStarted = tasks.filter((t) =>
        (t.source ?? "").toLowerCase().includes("shard-started"),
      );
      if (shardStarted.length >= PENDING_TASKS_SHARD_STARTED_BACKLOG) {
        return {
          status: "warn",
          summary: `${shardStarted.length} shard-started pending tasks.`,
          observed: { count: shardStarted.length },
          recommendation: "Large shard-started backlogs suggest recovery or allocation pressure.",
        };
      }
      return {
        status: "pass",
        summary: `Shard-started pending tasks (${shardStarted.length}) within threshold.`,
      };
    },
  },
  // cluster.delayed_unassigned_shards.nonzero
  {
    id: "cluster.delayed_unassigned_shards.nonzero",
    domain: "cluster",
    title: "Delayed unassigned shards",
    description: "Warns when delayed unassigned shards are present.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const count = snapshot.data.clusterCore?.clusterHealth?.delayed_unassigned_shards ?? 0;
      if (count > 0) {
        return {
          status: "warn",
          summary: `${count} delayed unassigned shard${count === 1 ? "" : "s"}.`,
          observed: { count },
          recommendation:
            "Delayed unassigned shards wait for a node to rejoin. Check for departed nodes.",
        };
      }
      return { status: "pass", summary: "No delayed unassigned shards." };
    },
  },
  // cluster.in_flight_fetch.high
  {
    id: "cluster.in_flight_fetch.high",
    domain: "cluster",
    title: "In-flight fetches high",
    description: "Warns when the number of in-flight shard fetches is high.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["clusterCore"],
    evaluate: (snapshot) => {
      const count = snapshot.data.clusterCore?.clusterHealth?.number_of_in_flight_fetch ?? 0;
      if (count >= IN_FLIGHT_FETCH_HIGH) {
        return {
          status: "warn",
          summary: `${count} in-flight shard fetches.`,
          observed: { count },
          recommendation:
            "High in-flight fetches indicate ongoing shard recovery or store operations.",
        };
      }
      return { status: "pass", summary: `In-flight fetches (${count}) within threshold.` };
    },
  },
];
