import type { TaskInfo, TasksListResponse } from "../../services/es";

import type { HealthCheckDefinition } from "../types";

const LONG_TASK_NANOS = 300_000_000_000; // 5 minutes

function flattenTasks(tasksCore: TasksListResponse | null | undefined): TaskInfo[] {
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
];
