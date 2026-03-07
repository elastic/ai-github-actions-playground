import type { ClusterTaskInfo, TasksListResponse } from "../../services/es";

import type { HealthCheckDefinition } from "../types";

const LONG_TASK_NANOS = 300_000_000_000; // 5 minutes

function flattenTasks(tasksCore: TasksListResponse | null | undefined): ClusterTaskInfo[] {
  const nodes = tasksCore?.nodes ?? {};
  return Object.values(nodes).flatMap((node) => Object.values(node.tasks ?? {}));
}

export const taskChecks: HealthCheckDefinition[] = [
  // #59
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
          observed: { task_count: tasks.length, threshold: 100 },
          recommendation: "High task count may indicate queue saturation or runaway operations.",
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: `${tasks.length} running tasks (within threshold).` };
    },
  },
  // #60
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
          observed: { long_running_count: longRunning.length, threshold_nanos: LONG_TASK_NANOS },
          recommendation: "Investigate or cancel long-running tasks to free cluster resources.",
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No long-running tasks beyond threshold." };
    },
  },
  // #61
  {
    id: "tasks.long_running.search",
    domain: "tasks",
    title: "Long-running search tasks",
    description: "Warns when long-running search tasks are present.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const longSearches = tasks.filter(
        (task) =>
          Number(task.running_time_in_nanos ?? 0) >= LONG_TASK_NANOS &&
          (task.action ?? "").includes("search"),
      );
      if (longSearches.length > 0) {
        return {
          status: "warn",
          summary: `${longSearches.length} long-running search task${longSearches.length === 1 ? "" : "s"} detected.`,
          observed: {
            long_search_count: longSearches.length,
            sample: longSearches.slice(0, 5).map((t) => ({
              action: t.action,
              running_nanos: t.running_time_in_nanos,
            })),
          },
          recommendation: "Review slow search queries. Consider cancelling or optimizing them.",
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No long-running search tasks." };
    },
  },
  // #62
  {
    id: "tasks.long_running.reindex",
    domain: "tasks",
    title: "Long-running reindex tasks",
    description: "Warns when long-running reindex tasks are detected.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const matched = tasks.filter(
        (t) =>
          (t.action ?? "").includes("reindex") &&
          Number(t.running_time_in_nanos ?? 0) >= LONG_TASK_NANOS,
      );
      if (matched.length > 0) {
        return {
          status: "warn",
          summary: `${matched.length} long-running reindex task${matched.length === 1 ? "" : "s"}.`,
          observed: { count: matched.length },
          recommendation:
            "Monitor reindex progress; consider slicing for large reindex operations.",
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No long-running reindex tasks." };
    },
  },
  // #63
  {
    id: "tasks.long_running.update_by_query",
    domain: "tasks",
    title: "Long-running update-by-query tasks",
    description: "Warns when long-running update_by_query tasks are detected.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const matched = tasks.filter(
        (t) =>
          (t.action ?? "").includes("update_by_query") &&
          Number(t.running_time_in_nanos ?? 0) >= LONG_TASK_NANOS,
      );
      if (matched.length > 0) {
        return {
          status: "warn",
          summary: `${matched.length} long-running update_by_query task${matched.length === 1 ? "" : "s"}.`,
          observed: { count: matched.length },
          recommendation: "Large update_by_query operations can consume significant resources.",
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No long-running update_by_query tasks." };
    },
  },
  // #64
  {
    id: "tasks.long_running.delete_by_query",
    domain: "tasks",
    title: "Long-running delete-by-query tasks",
    description: "Warns when long-running delete_by_query tasks are detected.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const matched = tasks.filter(
        (t) =>
          (t.action ?? "").includes("delete_by_query") &&
          Number(t.running_time_in_nanos ?? 0) >= LONG_TASK_NANOS,
      );
      if (matched.length > 0) {
        return {
          status: "warn",
          summary: `${matched.length} long-running delete_by_query task${matched.length === 1 ? "" : "s"}.`,
          observed: { count: matched.length },
          recommendation: "Large delete_by_query operations can cause significant merge overhead.",
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No long-running delete_by_query tasks." };
    },
  },
  // #65
  {
    id: "tasks.long_running.snapshot",
    domain: "tasks",
    title: "Long-running snapshot tasks",
    description: "Warns when long-running snapshot tasks are detected.",
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const matched = tasks.filter(
        (t) =>
          (t.action ?? "").includes("snapshot") &&
          Number(t.running_time_in_nanos ?? 0) >= LONG_TASK_NANOS,
      );
      if (matched.length > 0) {
        return {
          status: "warn",
          summary: `${matched.length} long-running snapshot task${matched.length === 1 ? "" : "s"}.`,
          observed: { count: matched.length },
          recommendation: "Long snapshot operations may impact cluster performance.",
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No long-running snapshot tasks." };
    },
  },
  // #66
  {
    id: "tasks.cancellable.long_running",
    domain: "tasks",
    title: "Cancellable long-running tasks",
    description: "Warns when cancellable tasks have been running beyond threshold.",
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const matched = tasks.filter(
        (t) => t.cancellable === true && Number(t.running_time_in_nanos ?? 0) >= LONG_TASK_NANOS,
      );
      if (matched.length > 0) {
        return {
          status: "warn",
          summary: `${matched.length} cancellable long-running task${matched.length === 1 ? "" : "s"}.`,
          observed: { count: matched.length },
          recommendation: "Consider cancelling stale tasks to free resources.",
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No cancellable long-running tasks." };
    },
  },
  // #68
  {
    id: "tasks.node_concentration.high",
    domain: "tasks",
    title: "Task node concentration",
    description: "Warns when tasks are heavily concentrated on a single node.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    evaluate: (snapshot) => {
      const nodeEntries = Object.entries(snapshot.data.tasksCore?.tasks?.nodes ?? {});
      if (nodeEntries.length < 2)
        return { status: "pass", summary: "Single node; concentration check not applicable." };
      const totalTasks = nodeEntries.reduce(
        (sum, [, n]) => sum + Object.keys(n.tasks ?? {}).length,
        0,
      );
      if (totalTasks === 0) return { status: "pass", summary: "No running tasks." };
      const maxNode = nodeEntries.reduce(
        (max, [, n]) => {
          const count = Object.keys(n.tasks ?? {}).length;
          return count > max.count ? { name: n.name ?? "unknown", count } : max;
        },
        { name: "unknown", count: 0 },
      );
      const ratio = maxNode.count / totalTasks;
      if (ratio >= 0.7 && totalTasks >= 20) {
        return {
          status: "warn",
          summary: `${maxNode.name} has ${maxNode.count}/${totalTasks} tasks (${(ratio * 100).toFixed(0)}%).`,
          observed: { node: maxNode.name, nodeCount: maxNode.count, totalTasks },
          recommendation: "Check for uneven query routing or a coordinator bottleneck.",
        };
      }
      return { status: "pass", summary: "Task distribution across nodes is balanced." };
    },
  },
  // #69
  {
    id: "tasks.action.risky.count.high",
    domain: "tasks",
    title: "Risky task actions running",
    description:
      "Warns when risky actions (delete_by_query, reindex, etc.) are running concurrently.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const riskyPatterns = ["delete_by_query", "reindex", "force_merge", "update_by_query"];
      const risky = tasks.filter((t) => {
        const action = t.action ?? "";
        return riskyPatterns.some((p) => action.includes(p));
      });
      if (risky.length >= 3) {
        return {
          status: "warn",
          summary: `${risky.length} risky task actions running concurrently.`,
          observed: { count: risky.length },
          recommendation: "Multiple concurrent risky operations may destabilize the cluster.",
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: `Risky task actions (${risky.length}) within threshold.` };
    },
  },
  // #70
  {
    id: "tasks.description.large_fanout",
    domain: "tasks",
    title: "Large fan-out tasks",
    description: "Warns when task descriptions indicate wildcard or multi-index fan-out.",
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const fanout = tasks.filter((t) => {
        const desc = t.description ?? "";
        return desc.includes("*") || (desc.match(/,/g) ?? []).length >= 5;
      });
      if (fanout.length > 0) {
        return {
          status: "warn",
          summary: `${fanout.length} task${fanout.length === 1 ? "" : "s"} with large fan-out patterns.`,
          observed: { count: fanout.length },
          recommendation: "Wildcard or many-index operations cause fan-out. Use targeted patterns.",
        };
      }
      return { status: "pass", summary: "No large fan-out task patterns detected." };
    },
  },
];
