import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { useDashboardStore } from "../../src/store/useDashboardStore";
import type { DashboardDefinition } from "../../src/types";

describe("useDashboardStore resetDashboardState", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Reset to a clean store state before each test
    useDashboardStore.setState({
      dashboard: {
        ...useDashboardStore.getState().dashboard,
        title: "Custom Title",
      },
    });
  });

  it("resets dashboard state to initial values", () => {
    useDashboardStore.getState().resetDashboardState();

    const state = useDashboardStore.getState();
    expect(state.dashboard.title).toBe("Default");
    expect(state.dashboard.panels.length).toBeGreaterThan(0);
  });
});

function makeValidDashboard(overrides: Partial<DashboardDefinition> = {}): DashboardDefinition {
  return {
    id: "dash-1",
    title: "Test Dashboard",
    panels: [
      {
        id: "panel-1",
        title: "Panel One",
        query: "FROM logs-* | LIMIT 10",
        visualization: "timeseries",
        layout: { x: 0, y: 0, w: 6, h: 4 },
      },
    ],
    timeRange: { from: "now-15m", to: "now" },
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("useDashboardStore addPanel / removePanel", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetDashboardState();
  });

  it("addPanel increases panel count", () => {
    const before = useDashboardStore.getState().dashboard.panels.length;
    useDashboardStore.getState().addPanel({
      id: "new-1",
      title: "New",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    expect(useDashboardStore.getState().dashboard.panels.length).toBe(before + 1);
  });

  it("removePanel removes the correct panel by ID", () => {
    useDashboardStore.getState().addPanel({
      id: "to-remove",
      title: "Remove Me",
      query: "FROM x",
      visualization: "table",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    const beforeCount = useDashboardStore.getState().dashboard.panels.length;

    useDashboardStore.getState().removePanel("to-remove");

    const after = useDashboardStore.getState().dashboard.panels;
    expect(after.length).toBe(beforeCount - 1);
    expect(after.find((p) => p.id === "to-remove")).toBeUndefined();
  });
});

describe("useDashboardStore duplicatePanel", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetDashboardState();
  });

  it("creates a copy with a new id and appended title", () => {
    const panels = useDashboardStore.getState().dashboard.panels;
    const sourceId = panels[0].id;
    const source = panels[0];

    const newId = useDashboardStore.getState().duplicatePanel(sourceId);

    expect(newId).toBeTruthy();
    const clone = useDashboardStore.getState().dashboard.panels.find((p) => p.id === newId);
    expect(clone).toBeDefined();
    expect(clone!.id).not.toBe(sourceId);
    expect(clone!.title).toBe(`${source.title} (copy)`);
    expect(clone!.query).toBe(source.query);
    expect(clone!.visualization).toBe(source.visualization);
  });

  it("preserves options on the duplicated panel", () => {
    useDashboardStore.getState().addPanel({
      id: "opts-panel",
      title: "With Options",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
      options: { stacked: true, horizontal: false },
    });

    const newId = useDashboardStore.getState().duplicatePanel("opts-panel");
    const clone = useDashboardStore.getState().dashboard.panels.find((p) => p.id === newId);

    expect(clone!.options).toEqual({ stacked: true, horizontal: false });
  });

  it("returns null for a non-existent panel", () => {
    const result = useDashboardStore.getState().duplicatePanel("does-not-exist");
    expect(result).toBeNull();
  });

  it("leaves state unchanged when duplicating a missing panel id", () => {
    const beforePanels = useDashboardStore.getState().dashboard.panels;
    const beforeUpdatedAt = useDashboardStore.getState().dashboard.updatedAt;
    const result = useDashboardStore.getState().duplicatePanel("missing-id");
    const afterPanels = useDashboardStore.getState().dashboard.panels;
    const afterUpdatedAt = useDashboardStore.getState().dashboard.updatedAt;
    expect(result).toBeNull();
    expect(afterPanels).toEqual(beforePanels);
    expect(afterUpdatedAt).toBe(beforeUpdatedAt);
  });

  it("increases panel count by exactly 1", () => {
    const before = useDashboardStore.getState().dashboard.panels.length;
    const sourceId = useDashboardStore.getState().dashboard.panels[0].id;

    useDashboardStore.getState().duplicatePanel(sourceId);

    expect(useDashboardStore.getState().dashboard.panels.length).toBe(before + 1);
  });

  it("sets layout.y to Infinity for grid reflow and preserves other layout props", () => {
    useDashboardStore.getState().addPanel({
      id: "layout-test",
      title: "Layout Test",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 3, y: 2, w: 8, h: 5 },
    });

    const newId = useDashboardStore.getState().duplicatePanel("layout-test");
    const clone = useDashboardStore.getState().dashboard.panels.find((p) => p.id === newId);

    expect(clone!.layout.y).toBe(Infinity);
    expect(clone!.layout.x).toBe(3);
    expect(clone!.layout.w).toBe(8);
    expect(clone!.layout.h).toBe(5);
  });

  it("advances the dashboard updatedAt timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    // Reset so updatedAt uses the fake time
    useDashboardStore.getState().resetDashboardState();

    const beforeTimestamp = useDashboardStore.getState().dashboard.updatedAt;
    const sourceId = useDashboardStore.getState().dashboard.panels[0].id;

    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    useDashboardStore.getState().duplicatePanel(sourceId);

    const afterTimestamp = useDashboardStore.getState().dashboard.updatedAt;
    expect(afterTimestamp).not.toBe(beforeTimestamp);
    vi.useRealTimers();
  });

  it("deep clones so source and clone do not share references", () => {
    useDashboardStore.getState().addPanel({
      id: "ref-test",
      title: "Ref Test",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
      options: { stacked: true, horizontal: false, format: { unit: "bytes", shortValues: true } },
    });

    const newId = useDashboardStore.getState().duplicatePanel("ref-test");
    const source = useDashboardStore.getState().dashboard.panels.find((p) => p.id === "ref-test");
    const clone = useDashboardStore.getState().dashboard.panels.find((p) => p.id === newId);

    // Layout values should be equal (except y which is Infinity)
    expect(clone!.layout.x).toBe(source!.layout.x);
    expect(clone!.layout.w).toBe(source!.layout.w);
    expect(clone!.layout.h).toBe(source!.layout.h);
    // Layout objects should not be the same reference
    expect(clone!.layout).not.toBe(source!.layout);
    // Options should be deeply equal but not the same reference
    expect(clone!.options).not.toBe(source!.options);
    // Nested format object should also be independent
    const cloneFormat = (clone!.options as Record<string, unknown>).format;
    const sourceFormat = (source!.options as Record<string, unknown>).format;
    expect(cloneFormat).toEqual(sourceFormat);
    expect(cloneFormat).not.toBe(sourceFormat);
  });

  it("normalizes copy suffix and increments copy counters", () => {
    useDashboardStore.getState().addPanel({
      id: "copy-source",
      title: "Panel",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });

    const firstCopyId = useDashboardStore.getState().duplicatePanel("copy-source");
    const secondCopyId = useDashboardStore.getState().duplicatePanel("copy-source");

    const firstCopy = useDashboardStore
      .getState()
      .dashboard.panels.find((p) => p.id === firstCopyId);
    const secondCopy = useDashboardStore
      .getState()
      .dashboard.panels.find((p) => p.id === secondCopyId);

    expect(firstCopy?.title).toBe("Panel (copy)");
    expect(secondCopy?.title).toBe("Panel (copy 2)");
  });

  it("normalizes source titles that already end with copy suffix", () => {
    useDashboardStore.getState().addPanel({
      id: "copy-suffixed-source",
      title: "Panel (copy)",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });

    const copyId = useDashboardStore.getState().duplicatePanel("copy-suffixed-source");
    const copy = useDashboardStore.getState().dashboard.panels.find((p) => p.id === copyId);
    expect(copy?.title).toBe("Panel (copy 2)");
  });
});

describe("useDashboardStore updatePanel", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetDashboardState();
  });

  it("merges partial updates into the target panel", () => {
    const panels = useDashboardStore.getState().dashboard.panels;
    const targetId = panels[0].id;

    useDashboardStore.getState().updatePanel(targetId, { title: "Updated Title" });

    const updated = useDashboardStore.getState().dashboard.panels.find((p) => p.id === targetId);
    expect(updated?.title).toBe("Updated Title");
    // Original query should be unchanged
    expect(updated?.query).toBe(panels[0].query);
  });

  it("does not affect unrelated panels", () => {
    const panels = useDashboardStore.getState().dashboard.panels;
    expect(panels.length).toBeGreaterThanOrEqual(2);

    const targetId = panels[0].id;
    const otherId = panels[1].id;
    const otherTitle = panels[1].title;

    useDashboardStore.getState().updatePanel(targetId, { title: "Changed" });

    const other = useDashboardStore.getState().dashboard.panels.find((p) => p.id === otherId);
    expect(other?.title).toBe(otherTitle);
  });
});

describe("useDashboardStore updatePanelLayouts", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetDashboardState();
  });

  it("updates layout positions without affecting other panel fields", () => {
    const panels = useDashboardStore.getState().dashboard.panels;
    const targetId = panels[0].id;
    const originalTitle = panels[0].title;

    useDashboardStore.getState().updatePanelLayouts([{ id: targetId, x: 3, y: 7, w: 8, h: 6 }]);

    const updated = useDashboardStore.getState().dashboard.panels.find((p) => p.id === targetId);
    expect(updated?.layout).toEqual(expect.objectContaining({ x: 3, y: 7, w: 8, h: 6 }));
    expect(updated?.title).toBe(originalTitle);
  });
});

describe("useDashboardStore setTimeRange / setDashboardTitle", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetDashboardState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("setTimeRange updates the time range and advances updatedAt", () => {
    const before = useDashboardStore.getState().dashboard.updatedAt;
    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    useDashboardStore.getState().setTimeRange({ from: "now-7d", to: "now" });

    const state = useDashboardStore.getState();
    expect(state.dashboard.timeRange).toEqual({ from: "now-7d", to: "now" });
    expect(state.dashboard.updatedAt).not.toBe(before);
  });

  it("setDashboardTitle updates the title and advances updatedAt", () => {
    const before = useDashboardStore.getState().dashboard.updatedAt;
    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    useDashboardStore.getState().setDashboardTitle("My Custom Title");

    const state = useDashboardStore.getState();
    expect(state.dashboard.title).toBe("My Custom Title");
    expect(state.dashboard.updatedAt).not.toBe(before);
  });
});

describe("useDashboardStore exportDashboard / importDashboard round-trip", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetDashboardState();
  });

  it("export then import preserves all fields", () => {
    // Modify the dashboard to have distinctive values
    useDashboardStore.getState().setDashboardTitle("Round-Trip Test");
    useDashboardStore.getState().setTimeRange({ from: "now-30d", to: "now" });

    const exported = useDashboardStore.getState().exportDashboard();

    // Reset to defaults and re-import
    useDashboardStore.getState().resetDashboardState();
    const result = useDashboardStore.getState().importDashboard(exported);

    expect(result).toEqual({ success: true });
    const state = useDashboardStore.getState();
    expect(state.dashboard.title).toBe("Round-Trip Test");
    expect(state.dashboard.timeRange).toEqual({ from: "now-30d", to: "now" });
  });

  it("exports dashboards using the Perses dashboard shape", () => {
    const exported = JSON.parse(useDashboardStore.getState().exportDashboard()) as {
      kind: string;
      metadata?: { name?: string };
      spec?: {
        panels?: Record<
          string,
          { spec?: { plugin?: { kind?: string }; queries?: Array<{ spec?: { query?: string } }> } }
        >;
      };
    };
    const state = useDashboardStore.getState();
    const exportedPanel = exported.spec?.panels?.[state.dashboard.panels[0].id];

    expect(exported.kind).toBe("Dashboard");
    expect(exported.metadata?.name).toBe(state.dashboard.id);
    expect(Object.keys(exported.spec?.panels ?? {})).toContain(state.dashboard.panels[0].id);
    expect(exportedPanel?.spec?.plugin?.kind).toBeDefined();
    expect(exportedPanel?.spec?.queries?.[0]?.spec?.query).toBe(state.dashboard.panels[0].query);
  });

  it("exports all canonical panel queries when present", () => {
    const state = useDashboardStore.getState();
    const panel = state.dashboard.panels[0];
    state.updatePanel(panel.id, {
      queries: ["FROM logs-* | LIMIT 5", "FROM metrics-* | LIMIT 5"],
      query: "FROM logs-* | LIMIT 5",
    });

    const exported = JSON.parse(state.exportDashboard()) as {
      spec?: {
        panels?: Record<string, { spec?: { queries?: Array<{ spec?: { query?: string } }> } }>;
      };
    };
    const exportedPanel = exported.spec?.panels?.[panel.id];

    expect(exportedPanel?.spec?.queries?.map((entry) => entry.spec?.query)).toEqual([
      "FROM logs-* | LIMIT 5",
      "FROM metrics-* | LIMIT 5",
    ]);
  });

  it("exports workspaces using the Perses workspace shape", () => {
    const exported = JSON.parse(useDashboardStore.getState().exportWorkspace()) as {
      kind: string;
      spec?: { dashboards?: unknown[]; activeDashboardId?: string };
    };
    const state = useDashboardStore.getState();

    expect(exported.kind).toBe("Workspace");
    expect(exported.spec?.dashboards?.length).toBe(state.dashboards.length);
    expect(exported.spec?.activeDashboardId).toBe(state.activeDashboardId);
  });
});

describe("useDashboardStore importDashboard", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetDashboardState();
  });

  it("imports a valid dashboard", () => {
    const dashboard = makeValidDashboard();
    const result = useDashboardStore.getState().importDashboard(JSON.stringify(dashboard));

    expect(result).toEqual({ success: true });
    const state = useDashboardStore.getState();
    expect(state.dashboard.id).toBe("dash-1");
    expect(state.dashboard.title).toBe("Test Dashboard");
    expect(state.dashboard.panels).toHaveLength(1);
    expect(state.dashboard.panels[0].id).toBe("panel-1");
  });

  it("imports a canonical Perses dashboard panel spec", () => {
    const result = useDashboardStore.getState().importDashboard(
      JSON.stringify({
        kind: "Dashboard",
        metadata: { name: "dash-perses" },
        spec: {
          display: { name: "Perses Dashboard" },
          panels: {
            "panel-1": {
              kind: "Panel",
              spec: {
                display: { name: "Panel One" },
                layout: { x: 0, y: 0, w: 6, h: 4 },
                plugin: { kind: "TimeSeriesChart", spec: { smooth: true } },
                queries: [
                  { kind: "EsqlQuery", spec: { query: "FROM logs-* | LIMIT 5" } },
                  { kind: "EsqlQuery", spec: { query: "FROM metrics-* | LIMIT 10" } },
                ],
              },
            },
          },
          timeRange: { from: "now-15m", to: "now" },
        },
      }),
    );

    expect(result).toEqual({ success: true });
    const panel = useDashboardStore.getState().dashboard.panels[0];
    expect(panel.query).toBe("FROM logs-* | LIMIT 5");
    expect(panel.queries).toEqual(["FROM logs-* | LIMIT 5", "FROM metrics-* | LIMIT 10"]);
    expect(panel.visualization).toBe("timeseries");
    expect(panel.options).toEqual({ smooth: true });
  });

  it("imports a legacy Perses dashboard panel spec", () => {
    const result = useDashboardStore.getState().importDashboard(
      JSON.stringify({
        kind: "Dashboard",
        metadata: { name: "dash-legacy-perses" },
        spec: {
          display: { name: "Legacy Perses Dashboard" },
          panels: {
            "panel-1": {
              kind: "Panel",
              spec: {
                display: { name: "Panel One" },
                query: "FROM logs-* | LIMIT 3",
                visualization: "bar",
                layout: { x: 0, y: 0, w: 6, h: 4 },
                options: { stacked: true },
              },
            },
          },
          timeRange: { from: "now-15m", to: "now" },
        },
      }),
    );

    expect(result).toEqual({ success: true });
    const panel = useDashboardStore.getState().dashboard.panels[0];
    expect(panel.query).toBe("FROM logs-* | LIMIT 3");
    expect(panel.visualization).toBe("bar");
    expect(panel.options).toEqual({ stacked: true });
  });

  it("imports a valid dashboard with a valid timezone", () => {
    const dashboard = makeValidDashboard({ timeZone: "UTC" });
    const result = useDashboardStore.getState().importDashboard(JSON.stringify(dashboard));

    expect(result).toEqual({ success: true });
    expect(useDashboardStore.getState().dashboard.timeZone).toBe("UTC");
  });

  it("rejects a dashboard with an invalid timezone", () => {
    const dashboard = makeValidDashboard({ timeZone: "Mars/Olympus" });
    const result = useDashboardStore.getState().importDashboard(JSON.stringify(dashboard));

    expect(result.success).toBe(false);
    expect(result.error).toContain("timeZone");
  });

  it("rejects invalid JSON", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalTitle = useDashboardStore.getState().dashboard.title;

    const result = useDashboardStore.getState().importDashboard("not json{{{");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(useDashboardStore.getState().dashboard.title).toBe(originalTitle);
    expect(spy).toHaveBeenCalledWith("Import failed: invalid JSON", expect.anything());
    spy.mockRestore();
  });

  it("rejects a dashboard missing required top-level fields", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalTitle = useDashboardStore.getState().dashboard.title;

    const result = useDashboardStore.getState().importDashboard(JSON.stringify({ id: "x" }));

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(useDashboardStore.getState().dashboard.title).toBe(originalTitle);
    expect(spy).toHaveBeenCalledWith("Import failed:", expect.stringContaining("title:"));
    spy.mockRestore();
  });

  it("rejects a panel with an empty id", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = makeValidDashboard({
      panels: [
        {
          id: "",
          title: "Empty ID",
          query: "FROM x",
          visualization: "bar",
          layout: { x: 0, y: 0, w: 6, h: 4 },
        },
      ],
    });

    const result = useDashboardStore.getState().importDashboard(JSON.stringify(bad));

    expect(result.success).toBe(false);
    expect(result.error).toContain("panels.0.id");
    expect(useDashboardStore.getState().dashboard.id).not.toBe("dash-1");
    spy.mockRestore();
  });

  it("rejects a panel with a missing id", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = makeValidDashboard({
      panels: [
        {
          title: "No ID",
          query: "FROM x",
          visualization: "bar",
          layout: { x: 0, y: 0, w: 6, h: 4 },
        },
      ] as DashboardDefinition["panels"],
    });

    const result = useDashboardStore.getState().importDashboard(JSON.stringify(bad));

    expect(result.success).toBe(false);
    expect(result.error).toContain("panels.0.id");
    expect(useDashboardStore.getState().dashboard.id).not.toBe("dash-1");
    spy.mockRestore();
  });

  it("rejects a panel with an invalid visualization type", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = makeValidDashboard({
      panels: [
        {
          id: "p-1",
          title: "Bad Viz",
          query: "FROM x",
          visualization: "treemap" as "bar",
          layout: { x: 0, y: 0, w: 6, h: 4 },
        },
      ],
    });

    const result = useDashboardStore.getState().importDashboard(JSON.stringify(bad));

    expect(result.success).toBe(false);
    expect(result.error).toContain("panels.0.visualization");
    expect(useDashboardStore.getState().dashboard.id).not.toBe("dash-1");
    spy.mockRestore();
  });

  it("rejects a panel with a missing layout field", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = makeValidDashboard({
      panels: [
        {
          id: "p-1",
          title: "No Layout",
          query: "FROM x",
          visualization: "table",
          layout: { x: 0, y: 0, w: 6 },
        },
      ] as DashboardDefinition["panels"],
    });

    const result = useDashboardStore.getState().importDashboard(JSON.stringify(bad));

    expect(result.success).toBe(false);
    expect(result.error).toContain("panels.0.layout.h");
    expect(useDashboardStore.getState().dashboard.id).not.toBe("dash-1");
    spy.mockRestore();
  });

  it("rejects a panel with zero-width layout", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = makeValidDashboard({
      panels: [
        {
          id: "p-1",
          title: "Zero Width",
          query: "FROM x",
          visualization: "table",
          layout: { x: 0, y: 0, w: 0, h: 4 },
        },
      ],
    });

    const result = useDashboardStore.getState().importDashboard(JSON.stringify(bad));

    expect(result.success).toBe(false);
    expect(result.error).toContain("panels.0.layout.w");
    expect(useDashboardStore.getState().dashboard.id).not.toBe("dash-1");
    spy.mockRestore();
  });

  it("accepts a dashboard with optional fields omitted", () => {
    const dashboard = makeValidDashboard();
    delete (dashboard as unknown as Record<string, unknown>).description;
    delete (dashboard as unknown as Record<string, unknown>).refreshInterval;

    const result = useDashboardStore.getState().importDashboard(JSON.stringify(dashboard));

    expect(result).toEqual({ success: true });
    expect(useDashboardStore.getState().dashboard.id).toBe("dash-1");
  });

  it("accepts panels with optional options and refreshInterval", () => {
    const dashboard = makeValidDashboard({
      panels: [
        {
          id: "p-1",
          title: "With Options",
          query: "FROM x",
          visualization: "bar",
          layout: { x: 0, y: 0, w: 6, h: 4 },
          options: { stacked: true },
          refreshInterval: 30,
        },
      ],
    });

    const result = useDashboardStore.getState().importDashboard(JSON.stringify(dashboard));

    expect(result).toEqual({ success: true });
    expect(useDashboardStore.getState().dashboard.panels[0].id).toBe("p-1");
  });

  it.each(["heatmap", "scatter", "histogram"] as const)(
    "accepts the %s visualization type",
    (vizType) => {
      const dashboard = makeValidDashboard({
        panels: [
          {
            id: "viz-panel",
            title: "New Viz",
            query: "FROM x",
            visualization: vizType,
            layout: { x: 0, y: 0, w: 6, h: 4 },
          },
        ],
      });

      const result = useDashboardStore.getState().importDashboard(JSON.stringify(dashboard));
      expect(result).toEqual({ success: true });
      expect(useDashboardStore.getState().dashboard.panels[0].visualization).toBe(vizType);
    },
  );
});

describe("useDashboardStore importWorkspace", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetDashboardState();
  });

  it("rejects workspace imports with duplicate dashboard ids", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const initial = useDashboardStore.getState();
    const workspace = {
      dashboards: [
        makeValidDashboard({ id: "duplicate-id", title: "Dashboard A" }),
        makeValidDashboard({ id: "duplicate-id", title: "Dashboard B" }),
      ],
      activeDashboardId: "duplicate-id",
    };

    const result = useDashboardStore.getState().importWorkspace(JSON.stringify(workspace));

    expect(result).toEqual({
      success: false,
      error: "dashboard IDs must be unique within a workspace import",
    });
    expect(useDashboardStore.getState().dashboard.id).toBe(initial.dashboard.id);
    expect(useDashboardStore.getState().dashboards).toEqual(initial.dashboards);
    expect(spy).toHaveBeenCalledWith(
      "Workspace import failed:",
      "dashboard IDs must be unique within a workspace import",
    );
    spy.mockRestore();
  });
});

describe("useDashboardStore undo/redo history", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useDashboardStore.getState().resetDashboardState();
  });

  it("starts with empty history", () => {
    expect(useDashboardStore.getState().historyPast).toHaveLength(0);
    expect(useDashboardStore.getState().historyFuture).toHaveLength(0);
  });

  it("undoDashboardChange does nothing when history is empty", () => {
    const before = useDashboardStore.getState().dashboard;
    useDashboardStore.getState().undoDashboardChange();
    expect(useDashboardStore.getState().dashboard).toBe(before);
  });

  it("redoDashboardChange does nothing when future is empty", () => {
    const before = useDashboardStore.getState().dashboard;
    useDashboardStore.getState().redoDashboardChange();
    expect(useDashboardStore.getState().dashboard).toBe(before);
  });

  it("addPanel pushes a history entry with correct label", () => {
    useDashboardStore.getState().addPanel({
      id: "p1",
      title: "My Panel",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });

    const { historyPast } = useDashboardStore.getState();
    expect(historyPast).toHaveLength(1);
    expect(historyPast[0]?.label).toBe('Added panel "My Panel"');
  });

  it("removePanel pushes a history entry with correct label", () => {
    useDashboardStore.getState().addPanel({
      id: "rem-panel",
      title: "To Remove",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    // Clear history so we're only testing removePanel
    useDashboardStore.setState({ historyPast: [], historyFuture: [] });

    useDashboardStore.getState().removePanel("rem-panel");

    const { historyPast } = useDashboardStore.getState();
    expect(historyPast).toHaveLength(1);
    expect(historyPast[0]?.label).toBe('Removed panel "To Remove"');
  });

  it("updatePanel pushes a history entry with correct label", () => {
    const panelId = useDashboardStore.getState().dashboard.panels[0].id;
    // Clear history from reset
    useDashboardStore.setState({ historyPast: [], historyFuture: [] });

    useDashboardStore.getState().updatePanel(panelId, { title: "Renamed" });

    const { historyPast } = useDashboardStore.getState();
    expect(historyPast).toHaveLength(1);
    // Label uses the updated title when a title change is included in the updates
    expect(historyPast[0]?.label).toBe('Updated panel "Renamed"');
  });

  it("updatePanel label uses original title when title is not in updates", () => {
    const panelId = useDashboardStore.getState().dashboard.panels[0].id;
    const panelTitle = useDashboardStore.getState().dashboard.panels[0].title;
    useDashboardStore.setState({ historyPast: [], historyFuture: [] });

    useDashboardStore.getState().updatePanel(panelId, { query: "FROM new-index-*" });

    const { historyPast } = useDashboardStore.getState();
    expect(historyPast).toHaveLength(1);
    expect(historyPast[0]?.label).toBe(`Updated panel "${panelTitle}"`);
  });

  it("duplicatePanel pushes a history entry with correct label", () => {
    const panelId = useDashboardStore.getState().dashboard.panels[0].id;
    const panelTitle = useDashboardStore.getState().dashboard.panels[0].title;
    useDashboardStore.setState({ historyPast: [], historyFuture: [] });

    useDashboardStore.getState().duplicatePanel(panelId);

    const { historyPast } = useDashboardStore.getState();
    expect(historyPast).toHaveLength(1);
    expect(historyPast[0]?.label).toBe(`Duplicated panel "${panelTitle}"`);
  });

  it("setDashboardTitle pushes a 'Renamed dashboard' history entry", () => {
    useDashboardStore.setState({ historyPast: [], historyFuture: [] });
    useDashboardStore.getState().setDashboardTitle("New Title");

    const { historyPast } = useDashboardStore.getState();
    expect(historyPast).toHaveLength(1);
    expect(historyPast[0]?.label).toBe("Renamed dashboard");
  });

  it("undo after addPanel restores the previous state and populates future", () => {
    const before = useDashboardStore.getState().dashboard;
    useDashboardStore.getState().addPanel({
      id: "undo-me",
      title: "Undo Panel",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    expect(
      useDashboardStore.getState().dashboard.panels.find((p) => p.id === "undo-me"),
    ).toBeDefined();

    useDashboardStore.getState().undoDashboardChange();

    const state = useDashboardStore.getState();
    expect(state.dashboard.panels.find((p) => p.id === "undo-me")).toBeUndefined();
    expect(state.historyPast).toHaveLength(0);
    expect(state.historyFuture).toHaveLength(1);
    expect(state.historyFuture[0]?.label).toBe('Added panel "Undo Panel"');
    // The dashboard object reference should match the saved snapshot
    expect(state.dashboard.panels.length).toBe(before.panels.length);
  });

  it("redo after undo re-applies the action", () => {
    useDashboardStore.getState().addPanel({
      id: "redo-me",
      title: "Redo Panel",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    useDashboardStore.getState().undoDashboardChange();
    expect(
      useDashboardStore.getState().dashboard.panels.find((p) => p.id === "redo-me"),
    ).toBeUndefined();

    useDashboardStore.getState().redoDashboardChange();

    const state = useDashboardStore.getState();
    expect(state.dashboard.panels.find((p) => p.id === "redo-me")).toBeDefined();
    expect(state.historyPast).toHaveLength(1);
    expect(state.historyFuture).toHaveLength(0);
  });

  it("new action after undo clears the future", () => {
    useDashboardStore.getState().addPanel({
      id: "panel-a",
      title: "Panel A",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    useDashboardStore.getState().undoDashboardChange();
    expect(useDashboardStore.getState().historyFuture).toHaveLength(1);

    // New action should clear the redo future
    useDashboardStore.getState().addPanel({
      id: "panel-b",
      title: "Panel B",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });

    expect(useDashboardStore.getState().historyFuture).toHaveLength(0);
  });

  it("importDashboard clears history", () => {
    useDashboardStore.getState().addPanel({
      id: "pre-import",
      title: "Pre Import",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    expect(useDashboardStore.getState().historyPast.length).toBeGreaterThan(0);

    const dashboard = makeValidDashboard();
    useDashboardStore.getState().importDashboard(JSON.stringify(dashboard));

    const state = useDashboardStore.getState();
    expect(state.historyPast).toHaveLength(0);
    expect(state.historyFuture).toHaveLength(0);
  });

  it("loadDefaultDashboard clears history", () => {
    useDashboardStore.getState().addPanel({
      id: "pre-load",
      title: "Pre Load",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    expect(useDashboardStore.getState().historyPast.length).toBeGreaterThan(0);

    useDashboardStore.getState().loadDefaultDashboard();

    const state = useDashboardStore.getState();
    expect(state.historyPast).toHaveLength(0);
    expect(state.historyFuture).toHaveLength(0);
  });

  it("resetDashboardState clears history", () => {
    useDashboardStore.getState().addPanel({
      id: "pre-reset",
      title: "Pre Reset",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });
    expect(useDashboardStore.getState().historyPast.length).toBeGreaterThan(0);

    useDashboardStore.getState().resetDashboardState();

    const state = useDashboardStore.getState();
    expect(state.historyPast).toHaveLength(0);
    expect(state.historyFuture).toHaveLength(0);
  });

  it("history is capped at MAX_HISTORY_DEPTH (50) entries", () => {
    for (let i = 0; i < 55; i++) {
      useDashboardStore.getState().addPanel({
        id: `panel-${i}`,
        title: `Panel ${i}`,
        query: "FROM x",
        visualization: "bar",
        layout: { x: 0, y: 0, w: 6, h: 4 },
      });
    }

    expect(useDashboardStore.getState().historyPast.length).toBe(50);
  });

  it("history is not persisted to localStorage", () => {
    useDashboardStore.getState().addPanel({
      id: "persist-test",
      title: "Persist Test",
      query: "FROM x",
      visualization: "bar",
      layout: { x: 0, y: 0, w: 6, h: 4 },
    });

    const persisted = JSON.parse(localStorage.getItem("elastic-peek-dashboard") ?? "{}") as {
      state?: { historyPast?: unknown };
    };
    expect(persisted.state?.historyPast).toBeUndefined();
  });
});
