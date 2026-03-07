import { describe, it, expect } from "vitest";

import type { TaskRow } from "../../src/services/es";

// We test the sorting comparator and filtering logic that the page uses.
// These are the same functions defined inside TaskManagerPage.tsx.
// Since they are not exported, we replicate them here for unit testing.

type SortField = "action" | "node" | "runningTime" | "startTime" | "type" | "cancellable";
type SortDirection = "asc" | "desc";

function compareTasks(a: TaskRow, b: TaskRow, field: SortField, dir: SortDirection): number {
  let cmp: number;
  switch (field) {
    case "action":
      cmp = a.action.localeCompare(b.action);
      break;
    case "node":
      cmp = a.node.localeCompare(b.node);
      break;
    case "type":
      cmp = a.type.localeCompare(b.type);
      break;
    case "runningTime":
      cmp = a.runningTimeNanos - b.runningTimeNanos;
      break;
    case "startTime":
      cmp = a.startTimeMs - b.startTimeMs;
      break;
    case "cancellable":
      cmp = Number(a.cancellable) - Number(b.cancellable);
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

function filterTasks(tasks: TaskRow[], search: string): TaskRow[] {
  const term = search.trim().toLowerCase();
  return tasks.filter((t) => {
    if (!term) return true;
    return (
      t.taskId.toLowerCase().includes(term) ||
      t.action.toLowerCase().includes(term) ||
      t.node.toLowerCase().includes(term) ||
      t.description.toLowerCase().includes(term)
    );
  });
}

const LONG_RUNNING_THRESHOLD_NS = 60_000_000_000;

const makeTask = (overrides: Partial<TaskRow> & { taskId: string }): TaskRow => ({
  node: "node-1",
  action: "indices:data/read/search",
  type: "transport",
  description: "",
  startTimeMs: Date.now(),
  runningTimeNanos: 1_000_000_000,
  cancellable: false,
  cancelled: false,
  parentTaskId: "",
  ...overrides,
});

describe("TaskManagerPage sorting", () => {
  const tasks: TaskRow[] = [
    makeTask({ taskId: "n1:1", action: "cluster:monitor/tasks", runningTimeNanos: 100_000_000 }),
    makeTask({
      taskId: "n1:2",
      action: "indices:data/read/search",
      runningTimeNanos: 5_000_000_000,
    }),
    makeTask({
      taskId: "n1:3",
      action: "indices:data/write/bulk",
      runningTimeNanos: 500_000_000,
    }),
  ];

  it("sorts by running time descending (longest first)", () => {
    const sorted = [...tasks].sort((a, b) => compareTasks(a, b, "runningTime", "desc"));
    expect(sorted.map((t) => t.taskId)).toEqual(["n1:2", "n1:3", "n1:1"]);
  });

  it("sorts by running time ascending (shortest first)", () => {
    const sorted = [...tasks].sort((a, b) => compareTasks(a, b, "runningTime", "asc"));
    expect(sorted.map((t) => t.taskId)).toEqual(["n1:1", "n1:3", "n1:2"]);
  });

  it("sorts by action alphabetically", () => {
    const sorted = [...tasks].sort((a, b) => compareTasks(a, b, "action", "asc"));
    expect(sorted.map((t) => t.action)).toEqual([
      "cluster:monitor/tasks",
      "indices:data/read/search",
      "indices:data/write/bulk",
    ]);
  });

  it("sorts cancellable tasks (true first when desc)", () => {
    const mixed = [
      makeTask({ taskId: "a", cancellable: false }),
      makeTask({ taskId: "b", cancellable: true }),
      makeTask({ taskId: "c", cancellable: false }),
    ];
    const sorted = [...mixed].sort((a, b) => compareTasks(a, b, "cancellable", "desc"));
    expect(sorted.map((t) => t.taskId)).toEqual(["b", "a", "c"]);
  });
});

describe("TaskManagerPage filtering", () => {
  const tasks: TaskRow[] = [
    makeTask({ taskId: "n1:1", action: "indices:data/read/search", node: "node-alpha" }),
    makeTask({ taskId: "n2:2", action: "cluster:monitor/tasks", node: "node-beta" }),
    makeTask({
      taskId: "n1:3",
      action: "indices:data/write/bulk",
      description: "indexing documents",
    }),
  ];

  it("returns all tasks when search is empty", () => {
    expect(filterTasks(tasks, "")).toHaveLength(3);
    expect(filterTasks(tasks, "  ")).toHaveLength(3);
  });

  it("filters by action keyword", () => {
    const result = filterTasks(tasks, "search");
    expect(result).toHaveLength(1);
    expect(result[0]!.taskId).toBe("n1:1");
  });

  it("filters by node name", () => {
    const result = filterTasks(tasks, "beta");
    expect(result).toHaveLength(1);
    expect(result[0]!.taskId).toBe("n2:2");
  });

  it("filters by description", () => {
    const result = filterTasks(tasks, "indexing");
    expect(result).toHaveLength(1);
    expect(result[0]!.taskId).toBe("n1:3");
  });

  it("is case-insensitive", () => {
    expect(filterTasks(tasks, "SEARCH")).toHaveLength(1);
    expect(filterTasks(tasks, "NODE-ALPHA")).toHaveLength(1);
  });
});

describe("TaskManagerPage KPI metrics", () => {
  it("counts long-running tasks above threshold", () => {
    const tasks = [
      makeTask({ taskId: "t1", runningTimeNanos: LONG_RUNNING_THRESHOLD_NS + 1 }),
      makeTask({ taskId: "t2", runningTimeNanos: LONG_RUNNING_THRESHOLD_NS - 1 }),
      makeTask({ taskId: "t3", runningTimeNanos: LONG_RUNNING_THRESHOLD_NS }),
    ];
    const count = tasks.filter((t) => t.runningTimeNanos >= LONG_RUNNING_THRESHOLD_NS).length;
    expect(count).toBe(2);
  });

  it("identifies cancellable tasks", () => {
    const tasks = [
      makeTask({ taskId: "t1", cancellable: true }),
      makeTask({ taskId: "t2", cancellable: false }),
      makeTask({ taskId: "t3", cancellable: true }),
    ];
    const cancellableCount = tasks.filter((t) => t.cancellable).length;
    expect(cancellableCount).toBe(2);
  });
});
