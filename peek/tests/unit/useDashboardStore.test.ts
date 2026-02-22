import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useDashboardStore } from "../../src/store/useDashboardStore";
import type { DashboardDefinition } from "../../src/types";

// Provide minimal localStorage/sessionStorage stubs so the persist middleware works
const makeStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

const localStorageMock = makeStorageMock();
const sessionStorageMock = makeStorageMock();

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("sessionStorage", sessionStorageMock);

describe("useDashboardStore resetState", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    // Reset to a clean store state before each test
    useDashboardStore.setState({
      connection: { url: "https://example.com", apiKey: "test-key" },
      connected: true,
      themeMode: "light",
      currentPage: "discover",
      discoverQueryDraft: "FROM logs-* | LIMIT 50",
      editingPanelId: "some-panel",
      connectionDialogOpen: true,
    });
  });

  it("resets all state to initial values", () => {
    useDashboardStore.getState().resetState();

    const state = useDashboardStore.getState();
    expect(state.connection).toBeNull();
    expect(state.connected).toBe(false);
    expect(state.themeMode).toBe("dark");
    expect(state.currentPage).toBe("dashboard");
    expect(state.discoverQueryDraft).toBeNull();
    expect(state.queryHistory).toEqual([]);
    expect(state.editingPanelId).toBeNull();
    expect(state.connectionDialogOpen).toBe(false);
  });

  it("resets the dashboard to the default dashboard", () => {
    useDashboardStore.getState().setDashboardTitle("Custom Title");
    useDashboardStore.getState().resetState();

    const { dashboard } = useDashboardStore.getState();
    expect(dashboard.title).toBe("Default");
    expect(dashboard.panels.length).toBeGreaterThan(0);
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
    localStorageMock.clear();
    sessionStorageMock.clear();
    useDashboardStore.getState().resetState();
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
    localStorageMock.clear();
    sessionStorageMock.clear();
    useDashboardStore.getState().resetState();
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
    useDashboardStore.getState().resetState();

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
});

describe("useDashboardStore updatePanel", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    useDashboardStore.getState().resetState();
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
    localStorageMock.clear();
    sessionStorageMock.clear();
    useDashboardStore.getState().resetState();
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

describe("useDashboardStore query history", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    useDashboardStore.getState().resetState();
  });

  it("prepends trimmed queries to history", () => {
    useDashboardStore.getState().appendQueryToHistory("  FROM logs-* | LIMIT 10  ");
    useDashboardStore.getState().appendQueryToHistory("FROM metrics-* | LIMIT 5");

    expect(useDashboardStore.getState().queryHistory).toEqual([
      "FROM metrics-* | LIMIT 5",
      "FROM logs-* | LIMIT 10",
    ]);
  });

  it("does not append adjacent duplicates", () => {
    useDashboardStore.getState().appendQueryToHistory("FROM logs-* | LIMIT 10");
    useDashboardStore.getState().appendQueryToHistory("FROM logs-* | LIMIT 10");

    expect(useDashboardStore.getState().queryHistory).toEqual(["FROM logs-* | LIMIT 10"]);
  });

  it("moves existing queries to the front instead of duplicating", () => {
    useDashboardStore.getState().appendQueryToHistory("FROM logs-* | LIMIT 10");
    useDashboardStore.getState().appendQueryToHistory("FROM metrics-* | LIMIT 5");
    useDashboardStore.getState().appendQueryToHistory("FROM logs-* | LIMIT 10");

    expect(useDashboardStore.getState().queryHistory).toEqual([
      "FROM logs-* | LIMIT 10",
      "FROM metrics-* | LIMIT 5",
    ]);
  });

  it("caps history size at 10 entries", () => {
    for (let i = 1; i <= 12; i += 1) {
      useDashboardStore.getState().appendQueryToHistory(`FROM logs-* | LIMIT ${i}`);
    }

    const history = useDashboardStore.getState().queryHistory;
    expect(history).toHaveLength(10);
    expect(history[0]).toBe("FROM logs-* | LIMIT 12");
    expect(history[9]).toBe("FROM logs-* | LIMIT 3");
  });
});

describe("useDashboardStore setTimeRange / setDashboardTitle", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    useDashboardStore.getState().resetState();
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
    localStorageMock.clear();
    sessionStorageMock.clear();
    useDashboardStore.getState().resetState();
  });

  it("export then import preserves all fields", () => {
    // Modify the dashboard to have distinctive values
    useDashboardStore.getState().setDashboardTitle("Round-Trip Test");
    useDashboardStore.getState().setTimeRange({ from: "now-30d", to: "now" });

    const exported = useDashboardStore.getState().exportDashboard();

    // Reset to defaults and re-import
    useDashboardStore.getState().resetState();
    const result = useDashboardStore.getState().importDashboard(exported);

    expect(result).toEqual({ success: true });
    const state = useDashboardStore.getState();
    expect(state.dashboard.title).toBe("Round-Trip Test");
    expect(state.dashboard.timeRange).toEqual({ from: "now-30d", to: "now" });
  });
});

describe("useDashboardStore importDashboard", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    useDashboardStore.getState().resetState();
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

describe("useDashboardStore connection profiles", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    useDashboardStore.getState().resetState();
  });

  it("saveConnectionProfile creates a profile from the current connection", () => {
    useDashboardStore.setState({
      connection: { url: "https://dev.example.com", apiKey: "dev-key" },
    });

    const id = useDashboardStore.getState().saveConnectionProfile("Dev Cluster");

    expect(id).toBeTruthy();
    const state = useDashboardStore.getState();
    expect(state.connectionProfiles).toHaveLength(1);
    expect(state.connectionProfiles[0].name).toBe("Dev Cluster");
    expect(state.connectionProfiles[0].connection.url).toBe("https://dev.example.com");
    expect(state.connectionProfiles[0].connection.apiKey).toBe("dev-key");
    expect(state.activeProfileId).toBe(id);
  });

  it("saveConnectionProfile returns null when no connection exists", () => {
    const id = useDashboardStore.getState().saveConnectionProfile("Empty");

    expect(id).toBeNull();
    expect(useDashboardStore.getState().connectionProfiles).toHaveLength(0);
  });

  it("saveConnectionProfile adds multiple profiles", () => {
    useDashboardStore.setState({
      connection: { url: "https://dev.example.com", apiKey: "dev-key" },
    });
    useDashboardStore.getState().saveConnectionProfile("Dev");

    useDashboardStore.setState({
      connection: { url: "https://prod.example.com", apiKey: "prod-key" },
    });
    useDashboardStore.getState().saveConnectionProfile("Prod");

    expect(useDashboardStore.getState().connectionProfiles).toHaveLength(2);
  });

  it("deleteConnectionProfile removes the profile by ID", () => {
    useDashboardStore.setState({
      connection: { url: "https://dev.example.com", apiKey: "dev-key" },
    });
    const id = useDashboardStore.getState().saveConnectionProfile("Dev");

    useDashboardStore.getState().deleteConnectionProfile(id!);

    expect(useDashboardStore.getState().connectionProfiles).toHaveLength(0);
  });

  it("deleteConnectionProfile clears activeProfileId when deleting the active profile", () => {
    useDashboardStore.setState({
      connection: { url: "https://dev.example.com", apiKey: "dev-key" },
    });
    const id = useDashboardStore.getState().saveConnectionProfile("Dev");
    expect(useDashboardStore.getState().activeProfileId).toBe(id);

    useDashboardStore.getState().deleteConnectionProfile(id!);

    expect(useDashboardStore.getState().activeProfileId).toBeNull();
  });

  it("deleteConnectionProfile preserves activeProfileId when deleting a different profile", () => {
    useDashboardStore.setState({
      connection: { url: "https://dev.example.com", apiKey: "dev-key" },
    });
    const devId = useDashboardStore.getState().saveConnectionProfile("Dev");

    useDashboardStore.setState({
      connection: { url: "https://prod.example.com", apiKey: "prod-key" },
    });
    const prodId = useDashboardStore.getState().saveConnectionProfile("Prod");

    useDashboardStore.getState().deleteConnectionProfile(devId!);

    expect(useDashboardStore.getState().activeProfileId).toBe(prodId);
    expect(useDashboardStore.getState().connectionProfiles).toHaveLength(1);
  });

  it("renameConnectionProfile updates the profile name", () => {
    useDashboardStore.setState({
      connection: { url: "https://dev.example.com", apiKey: "dev-key" },
    });
    const id = useDashboardStore.getState().saveConnectionProfile("Dev");

    useDashboardStore.getState().renameConnectionProfile(id!, "Development");

    const profile = useDashboardStore.getState().connectionProfiles[0];
    expect(profile.name).toBe("Development");
    expect(profile.connection.url).toBe("https://dev.example.com");
  });

  it("getConnectionProfile returns the correct profile", () => {
    useDashboardStore.setState({
      connection: { url: "https://dev.example.com", apiKey: "dev-key" },
    });
    const id = useDashboardStore.getState().saveConnectionProfile("Dev");

    const profile = useDashboardStore.getState().getConnectionProfile(id!);

    expect(profile).toBeDefined();
    expect(profile!.name).toBe("Dev");
  });

  it("getConnectionProfile returns undefined for unknown id", () => {
    const profile = useDashboardStore.getState().getConnectionProfile("nonexistent");

    expect(profile).toBeUndefined();
  });

  it("setActiveProfileId updates the active profile", () => {
    useDashboardStore.getState().setActiveProfileId("some-id");

    expect(useDashboardStore.getState().activeProfileId).toBe("some-id");
  });

  it("resetState clears connection profiles", () => {
    useDashboardStore.setState({
      connection: { url: "https://dev.example.com", apiKey: "dev-key" },
    });
    useDashboardStore.getState().saveConnectionProfile("Dev");
    expect(useDashboardStore.getState().connectionProfiles).toHaveLength(1);

    useDashboardStore.getState().resetState();

    expect(useDashboardStore.getState().connectionProfiles).toHaveLength(0);
    expect(useDashboardStore.getState().activeProfileId).toBeNull();
  });
});
