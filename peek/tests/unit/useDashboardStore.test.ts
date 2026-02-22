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
          visualization: "heatmap" as "bar",
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
});
