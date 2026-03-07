import type { ClusterTaskInfo, TasksListResponse } from "../../services/es";

import type { HealthCheckDefinition } from "../types";

const LONG_TASK_NANOS = 300_000_000_000; // 5 minutes
const VERY_LONG_TASK_NANOS = 3_600_000_000_000; // 1 hour

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
  if (task.type === "persistent") return true;
  const action = task.action ?? "";
  return PERSISTENT_TASK_PREFIXES.some((prefix) => action.startsWith(prefix));
}

function flattenTasks(tasksCore: TasksListResponse | null | undefined): ClusterTaskInfo[] {
  const nodes = tasksCore?.nodes ?? {};
  return Object.values(nodes).flatMap((node) => Object.values(node.tasks ?? {}));
}

function getNonPersistentLongRunning(tasks: ClusterTaskInfo[]): ClusterTaskInfo[] {
  return tasks.filter(
    (task) =>
      Number(task.running_time_in_nanos ?? 0) >= LONG_TASK_NANOS &&
      !isPersistentSystemTask(task),
  );
}

export const tasksChecks: HealthCheckDefinition[] = [
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
      "Warns when non-persistent tasks exceed 5 minutes. Persistent system tasks (transforms, health-node, geoip-downloader, etc.) are excluded.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/list-tasks",
    recommendation:
      "Long-running non-persistent tasks may be stuck queries or bulk operations. Consider cancelling them if they are not making progress.",
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const longRunning = getNonPersistentLongRunning(tasks);
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
    id: "tasks.long_running.very_long",
    domain: "tasks",
    title: "Very long-running tasks",
    description:
      "Fails when non-persistent tasks exceed 1 hour — likely stuck or stalled operations.",
    severityOnFail: "high",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/list-tasks",
    recommendation:
      "Tasks running over an hour are almost certainly stuck. Cancel them if possible and investigate the root cause.",
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const veryLong = tasks.filter(
        (task) =>
          Number(task.running_time_in_nanos ?? 0) >= VERY_LONG_TASK_NANOS &&
          !isPersistentSystemTask(task),
      );
      if (veryLong.length > 0) {
        return {
          status: "fail",
          summary: `${veryLong.length} task${veryLong.length === 1 ? "" : "s"} running over 1 hour.`,
          observed: {
            veryLongRunning: veryLong.slice(0, 5).map((t) => ({
              action: t.action,
              running_time_in_nanos: t.running_time_in_nanos,
              cancellable: t.cancellable,
            })),
          },
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No tasks running over 1 hour." };
    },
  },
  {
    id: "tasks.long_running.search",
    domain: "tasks",
    title: "Long-running search tasks",
    description: "Warns when search tasks exceed 5 minutes — may indicate unoptimized queries.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/list-tasks",
    recommendation:
      "Long search tasks can exhaust resources. Check slow query logs and optimize expensive aggregations or wildcards.",
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const longSearches = tasks.filter(
        (t) =>
          Number(t.running_time_in_nanos ?? 0) >= LONG_TASK_NANOS &&
          (t.action?.includes("search") ?? false) &&
          !isPersistentSystemTask(t),
      );
      if (longSearches.length > 0) {
        return {
          status: "warn",
          summary: `${longSearches.length} long-running search task${longSearches.length === 1 ? "" : "s"}.`,
          observed: {
            longSearches: longSearches.slice(0, 5).map((t) => ({
              action: t.action,
              running_time_in_nanos: t.running_time_in_nanos,
            })),
          },
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No long-running search tasks." };
    },
  },
  {
    id: "tasks.long_running.reindex",
    domain: "tasks",
    title: "Long-running reindex tasks",
    description: "Warns when reindex/update-by-query/delete-by-query tasks exceed 5 minutes.",
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/list-tasks",
    recommendation:
      "Long-running bulk mutation tasks consume cluster resources. Check progress and consider using slicing for large operations.",
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const bulkMutations = tasks.filter(
        (t) =>
          Number(t.running_time_in_nanos ?? 0) >= LONG_TASK_NANOS &&
          (t.action?.includes("reindex") ||
            t.action?.includes("update_by_query") ||
            t.action?.includes("delete_by_query")) &&
          !isPersistentSystemTask(t),
      );
      if (bulkMutations.length > 0) {
        return {
          status: "warn",
          summary: `${bulkMutations.length} long-running bulk mutation task${bulkMutations.length === 1 ? "" : "s"}.`,
          observed: {
            tasks: bulkMutations.slice(0, 5).map((t) => ({
              action: t.action,
              running_time_in_nanos: t.running_time_in_nanos,
            })),
          },
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No long-running bulk mutation tasks." };
    },
  },
  {
    id: "tasks.node_concentration",
    domain: "tasks",
    title: "Task node concentration",
    description:
      "Warns when one node has significantly more tasks than others (>= 3x the median), indicating uneven workload.",
    severityOnFail: "medium",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/list-tasks",
    recommendation:
      "Task concentration may indicate client affinity to one node or uneven shard distribution. Check routing and balancing.",
    evaluate: (snapshot) => {
      const nodeEntries = Object.entries(snapshot.data.tasksCore?.tasks?.nodes ?? {});
      if (nodeEntries.length < 2) {
        return { status: "pass", summary: "Too few nodes to assess task concentration." };
      }
      const counts = nodeEntries
        .map(([, node]) => ({
          name: node.name ?? "unknown",
          count: Object.keys(node.tasks ?? {}).length,
        }))
        .sort((a, b) => a.count - b.count);
      const median = counts[Math.floor(counts.length / 2)]?.count ?? 0;
      const max = counts[counts.length - 1] ?? { name: "unknown", count: 0 };
      if (median > 0 && max.count >= 10 && max.count / median >= 3) {
        return {
          status: "warn",
          summary: `Task concentration: ${max.name} has ${max.count} tasks vs median ${median}.`,
          observed: { hotNode: max.name, maxTasks: max.count, medianTasks: median },
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "Task distribution across nodes is balanced." };
    },
  },
  {
    id: "tasks.cancellable.long_running",
    domain: "tasks",
    title: "Cancellable long-running tasks",
    description:
      "Informs when long-running non-persistent tasks are cancellable, enabling easy cleanup.",
    severityOnFail: "low",
    surfaces: ["global"],
    dependsOn: ["tasksCore"],
    docsUrl: "https://www.elastic.co/docs/reference/elasticsearch/rest-apis/cancel-task",
    recommendation:
      "These tasks can be cancelled via the Task Cancel API if they are no longer needed.",
    evaluate: (snapshot) => {
      const tasks = flattenTasks(snapshot.data.tasksCore?.tasks ?? null);
      const cancellable = getNonPersistentLongRunning(tasks).filter((t) => t.cancellable);
      if (cancellable.length > 0) {
        return {
          status: "warn",
          summary: `${cancellable.length} cancellable long-running task${cancellable.length === 1 ? "" : "s"}.`,
          observed: {
            cancellable: cancellable.slice(0, 5).map((t) => ({
              action: t.action,
              running_time_in_nanos: t.running_time_in_nanos,
            })),
          },
          links: [{ label: "Task Manager", to: "/cluster-tasks" }],
        };
      }
      return { status: "pass", summary: "No cancellable long-running tasks." };
    },
  },
];
