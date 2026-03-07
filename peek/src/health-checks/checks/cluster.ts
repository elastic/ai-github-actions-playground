import type { HealthCheckDefinition } from "../types";

const INITIALIZING_SHARDS_THRESHOLD = 5;
const RELOCATING_SHARDS_THRESHOLD = 5;

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
      const status = snapshot.data.clusterCore?.clusterHealth?.status ?? "unknown";
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
      const status = snapshot.data.clusterCore?.clusterHealth?.status ?? "unknown";
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
      const unassigned = snapshot.data.clusterCore?.clusterHealth?.unassigned_shards ?? 0;
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
      const initializing = snapshot.data.clusterCore?.clusterHealth?.initializing_shards ?? 0;
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
      const relocating = snapshot.data.clusterCore?.clusterHealth?.relocating_shards ?? 0;
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
      const threshold = 100;
      if (percent != null && percent < threshold) {
        return {
          status: "warn",
          summary: `Active shards percentage is ${percent.toFixed(1)}%.`,
          observed: { active_shards_percent: percent, threshold },
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
];
