import { describe, it, expect } from "vitest";

import type { IlmIndexRow, IlmPolicyRow } from "../../src/services/es";

// Replicate sorting/filtering logic from IlmPage.tsx for unit testing.

type IndexSortField = "index" | "policy" | "phase" | "step" | "age" | "error";
type PolicySortField = "name" | "version" | "modifiedDate" | "indexCount";
type SortDirection = "asc" | "desc";

function compareIndexRows(
  a: IlmIndexRow,
  b: IlmIndexRow,
  field: IndexSortField,
  dir: SortDirection,
): number {
  let cmp: number;
  switch (field) {
    case "index":
      cmp = a.index.localeCompare(b.index);
      break;
    case "policy":
      cmp = a.policy.localeCompare(b.policy);
      break;
    case "phase":
      cmp = a.phase.localeCompare(b.phase);
      break;
    case "step":
      cmp = a.step.localeCompare(b.step);
      break;
    case "age":
      cmp = a.age.localeCompare(b.age);
      break;
    case "error":
      cmp = Number(a.isError) - Number(b.isError);
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

function comparePolicyRows(
  a: IlmPolicyRow,
  b: IlmPolicyRow,
  field: PolicySortField,
  dir: SortDirection,
): number {
  let cmp: number;
  switch (field) {
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "version":
      cmp = a.version - b.version;
      break;
    case "modifiedDate":
      cmp = a.modifiedDate.localeCompare(b.modifiedDate);
      break;
    case "indexCount":
      cmp = a.indexCount - b.indexCount;
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

const makeIndexRow = (overrides: Partial<IlmIndexRow> & { index: string }): IlmIndexRow => ({
  policy: "default-policy",
  phase: "hot",
  action: "complete",
  step: "complete",
  age: "5d",
  failedStep: "",
  isError: false,
  stepReason: "",
  ...overrides,
});

const makePolicyRow = (overrides: Partial<IlmPolicyRow> & { name: string }): IlmPolicyRow => ({
  version: 1,
  modifiedDate: "2026-01-01",
  phases: ["hot", "warm", "delete"],
  indexCount: 0,
  dataStreamCount: 0,
  templateCount: 0,
  ...overrides,
});

describe("IlmPage index sorting", () => {
  const rows: IlmIndexRow[] = [
    makeIndexRow({ index: "web-logs-a", phase: "warm", isError: false }),
    makeIndexRow({ index: "web-logs-b", phase: "hot", isError: true }),
    makeIndexRow({ index: "web-logs-c", phase: "cold", isError: false }),
  ];

  it("sorts by error desc (errors first)", () => {
    const sorted = [...rows].sort((a, b) => compareIndexRows(a, b, "error", "desc"));
    expect(sorted[0]!.index).toBe("web-logs-b");
  });

  it("sorts by index name ascending", () => {
    const sorted = [...rows].sort((a, b) => compareIndexRows(a, b, "index", "asc"));
    expect(sorted.map((r) => r.index)).toEqual(["web-logs-a", "web-logs-b", "web-logs-c"]);
  });

  it("sorts by phase ascending", () => {
    const sorted = [...rows].sort((a, b) => compareIndexRows(a, b, "phase", "asc"));
    expect(sorted.map((r) => r.phase)).toEqual(["cold", "hot", "warm"]);
  });
});

describe("IlmPage policy sorting", () => {
  const policies: IlmPolicyRow[] = [
    makePolicyRow({ name: "z-policy", version: 1, indexCount: 10 }),
    makePolicyRow({ name: "a-policy", version: 3, indexCount: 2 }),
    makePolicyRow({ name: "m-policy", version: 2, indexCount: 5 }),
  ];

  it("sorts by name ascending", () => {
    const sorted = [...policies].sort((a, b) => comparePolicyRows(a, b, "name", "asc"));
    expect(sorted.map((p) => p.name)).toEqual(["a-policy", "m-policy", "z-policy"]);
  });

  it("sorts by version descending", () => {
    const sorted = [...policies].sort((a, b) => comparePolicyRows(a, b, "version", "desc"));
    expect(sorted.map((p) => p.version)).toEqual([3, 2, 1]);
  });

  it("sorts by index count ascending", () => {
    const sorted = [...policies].sort((a, b) => comparePolicyRows(a, b, "indexCount", "asc"));
    expect(sorted.map((p) => p.indexCount)).toEqual([2, 5, 10]);
  });
});

describe("IlmPage filtering", () => {
  const rows: IlmIndexRow[] = [
    makeIndexRow({ index: "web-logs-2026.01", policy: "logs-lifecycle" }),
    makeIndexRow({ index: "metrics-cpu-2026.01", policy: "metrics-lifecycle", isError: true }),
    makeIndexRow({ index: "web-logs-2026.02", policy: "logs-lifecycle" }),
  ];

  it("filters by index name", () => {
    const term = "metrics";
    const filtered = rows.filter((r) => r.index.toLowerCase().includes(term));
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.index).toBe("metrics-cpu-2026.01");
  });

  it("filters by policy name", () => {
    const term = "logs-lifecycle";
    const filtered = rows.filter((r) => r.policy.toLowerCase().includes(term));
    expect(filtered).toHaveLength(2);
  });

  it("only-errors toggle filters to error rows", () => {
    const onlyErrors = true;
    const filtered = rows.filter((r) => !onlyErrors || r.isError);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.index).toBe("metrics-cpu-2026.01");
  });
});

describe("IlmPage metrics", () => {
  it("counts error indices", () => {
    const rows = [
      makeIndexRow({ index: "a", isError: true }),
      makeIndexRow({ index: "b", isError: false }),
      makeIndexRow({ index: "c", isError: true }),
    ];
    expect(rows.filter((r) => r.isError).length).toBe(2);
  });

  it("computes phase distribution", () => {
    const rows = [
      makeIndexRow({ index: "a", phase: "hot" }),
      makeIndexRow({ index: "b", phase: "hot" }),
      makeIndexRow({ index: "c", phase: "warm" }),
      makeIndexRow({ index: "d", phase: "delete" }),
    ];
    const dist: Record<string, number> = {};
    for (const row of rows) {
      const p = row.phase || "unknown";
      dist[p] = (dist[p] ?? 0) + 1;
    }
    expect(dist).toEqual({ hot: 2, warm: 1, delete: 1 });
  });
});
