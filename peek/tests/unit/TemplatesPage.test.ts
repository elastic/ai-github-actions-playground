import { describe, it, expect } from "vitest";

import type { IndexTemplateRow, ComponentTemplateRow } from "../../src/services/es";

// Replicate sorting/filtering logic from TemplatesPage.tsx for unit testing.

type IndexTplSortField = "name" | "priority" | "composedOfCount" | "dataStream";
type CompTplSortField = "name" | "usedByCount" | "version";
type SortDirection = "asc" | "desc";

function compareIndexTpls(
  a: IndexTemplateRow,
  b: IndexTemplateRow,
  field: IndexTplSortField,
  dir: SortDirection,
): number {
  let cmp: number;
  switch (field) {
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "priority":
      cmp = a.priority - b.priority;
      break;
    case "composedOfCount":
      cmp = a.composedOfCount - b.composedOfCount;
      break;
    case "dataStream":
      cmp = Number(a.dataStreamEnabled) - Number(b.dataStreamEnabled);
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

function compareCompTpls(
  a: ComponentTemplateRow,
  b: ComponentTemplateRow,
  field: CompTplSortField,
  dir: SortDirection,
): number {
  let cmp: number;
  switch (field) {
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "usedByCount":
      cmp = a.usedByCount - b.usedByCount;
      break;
    case "version":
      cmp = String(a.version).localeCompare(String(b.version));
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

const HIGH_PRIORITY_THRESHOLD = 500;

const makeIndexTemplate = (
  overrides: Partial<IndexTemplateRow> & { name: string },
): IndexTemplateRow => ({
  indexPatterns: ["logs-*"],
  priority: 100,
  composedOfCount: 0,
  composedOf: [],
  dataStreamEnabled: false,
  version: 1,
  ...overrides,
});

const makeComponentTemplate = (
  overrides: Partial<ComponentTemplateRow> & { name: string },
): ComponentTemplateRow => ({
  hasMappings: false,
  hasSettings: false,
  hasAliases: false,
  version: 1,
  usedByCount: 0,
  ...overrides,
});

describe("TemplatesPage index template sorting", () => {
  const templates: IndexTemplateRow[] = [
    makeIndexTemplate({ name: "logs-nginx", priority: 200, composedOfCount: 3 }),
    makeIndexTemplate({ name: "metrics-system", priority: 100, composedOfCount: 1 }),
    makeIndexTemplate({
      name: "apm-traces",
      priority: 500,
      composedOfCount: 2,
      dataStreamEnabled: true,
    }),
  ];

  it("sorts by name ascending", () => {
    const sorted = [...templates].sort((a, b) => compareIndexTpls(a, b, "name", "asc"));
    expect(sorted.map((t) => t.name)).toEqual(["apm-traces", "logs-nginx", "metrics-system"]);
  });

  it("sorts by priority descending (highest first)", () => {
    const sorted = [...templates].sort((a, b) => compareIndexTpls(a, b, "priority", "desc"));
    expect(sorted.map((t) => t.priority)).toEqual([500, 200, 100]);
  });

  it("sorts by composed-of count ascending", () => {
    const sorted = [...templates].sort((a, b) => compareIndexTpls(a, b, "composedOfCount", "asc"));
    expect(sorted.map((t) => t.composedOfCount)).toEqual([1, 2, 3]);
  });

  it("sorts data-stream enabled desc (true first)", () => {
    const sorted = [...templates].sort((a, b) => compareIndexTpls(a, b, "dataStream", "desc"));
    expect(sorted[0]!.dataStreamEnabled).toBe(true);
  });
});

describe("TemplatesPage component template sorting", () => {
  const components: ComponentTemplateRow[] = [
    makeComponentTemplate({ name: "z-comp", usedByCount: 1 }),
    makeComponentTemplate({ name: "a-comp", usedByCount: 5 }),
    makeComponentTemplate({ name: "m-comp", usedByCount: 3 }),
  ];

  it("sorts by name ascending", () => {
    const sorted = [...components].sort((a, b) => compareCompTpls(a, b, "name", "asc"));
    expect(sorted.map((c) => c.name)).toEqual(["a-comp", "m-comp", "z-comp"]);
  });

  it("sorts by used-by count descending", () => {
    const sorted = [...components].sort((a, b) => compareCompTpls(a, b, "usedByCount", "desc"));
    expect(sorted.map((c) => c.usedByCount)).toEqual([5, 3, 1]);
  });
});

describe("TemplatesPage filtering", () => {
  const templates: IndexTemplateRow[] = [
    makeIndexTemplate({
      name: "logs-nginx",
      indexPatterns: ["logs-nginx*"],
      composedOf: ["logs-mappings"],
    }),
    makeIndexTemplate({
      name: "metrics-system",
      indexPatterns: ["metrics-*"],
      composedOf: ["metrics-settings"],
    }),
    makeIndexTemplate({
      name: "apm-traces",
      indexPatterns: ["traces-apm*"],
      composedOf: ["apm-mappings"],
    }),
  ];

  it("filters by template name", () => {
    const term = "nginx";
    const filtered = templates.filter((t) => t.name.toLowerCase().includes(term));
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.name).toBe("logs-nginx");
  });

  it("filters by index pattern", () => {
    const term = "metrics";
    const filtered = templates.filter((t) =>
      t.indexPatterns.some((p) => p.toLowerCase().includes(term)),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.name).toBe("metrics-system");
  });

  it("filters by composed-of reference", () => {
    const term = "apm-mappings";
    const filtered = templates.filter((t) =>
      t.composedOf.some((c) => c.toLowerCase().includes(term)),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.name).toBe("apm-traces");
  });
});

describe("TemplatesPage metrics", () => {
  it("counts data-stream enabled templates", () => {
    const templates = [
      makeIndexTemplate({ name: "a", dataStreamEnabled: true }),
      makeIndexTemplate({ name: "b", dataStreamEnabled: false }),
      makeIndexTemplate({ name: "c", dataStreamEnabled: true }),
    ];
    expect(templates.filter((t) => t.dataStreamEnabled).length).toBe(2);
  });

  it("counts high-priority templates", () => {
    const templates = [
      makeIndexTemplate({ name: "a", priority: 100 }),
      makeIndexTemplate({ name: "b", priority: 500 }),
      makeIndexTemplate({ name: "c", priority: 600 }),
    ];
    expect(templates.filter((t) => t.priority >= HIGH_PRIORITY_THRESHOLD).length).toBe(2);
  });
});
