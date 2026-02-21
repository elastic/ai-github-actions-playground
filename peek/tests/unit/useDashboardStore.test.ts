import { describe, it, expect, beforeEach, vi } from "vitest";
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

describe("useDashboardStore importDashboard", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
    useDashboardStore.getState().resetState();
  });

  it("imports a valid dashboard", () => {
    const dashboard = makeValidDashboard();
    useDashboardStore.getState().importDashboard(JSON.stringify(dashboard));

    const state = useDashboardStore.getState();
    expect(state.dashboard.id).toBe("dash-1");
    expect(state.dashboard.title).toBe("Test Dashboard");
    expect(state.dashboard.panels).toHaveLength(1);
    expect(state.dashboard.panels[0].id).toBe("panel-1");
  });

  it("rejects invalid JSON", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalTitle = useDashboardStore.getState().dashboard.title;

    useDashboardStore.getState().importDashboard("not json{{{");

    expect(useDashboardStore.getState().dashboard.title).toBe(originalTitle);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Import failed"), expect.anything());
    spy.mockRestore();
  });

  it("rejects a dashboard missing required top-level fields", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalTitle = useDashboardStore.getState().dashboard.title;

    useDashboardStore.getState().importDashboard(JSON.stringify({ id: "x" }));

    expect(useDashboardStore.getState().dashboard.title).toBe(originalTitle);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Import failed"), expect.anything());
    spy.mockRestore();
  });

  it("rejects a panel with a missing id", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = makeValidDashboard({
      panels: [
        { title: "No ID", query: "FROM x", visualization: "bar", layout: { x: 0, y: 0, w: 6, h: 4 } },
      ] as DashboardDefinition["panels"],
    });

    useDashboardStore.getState().importDashboard(JSON.stringify(bad));

    expect(useDashboardStore.getState().dashboard.id).not.toBe("dash-1");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Import failed"), expect.anything());
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

    useDashboardStore.getState().importDashboard(JSON.stringify(bad));

    expect(useDashboardStore.getState().dashboard.id).not.toBe("dash-1");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Import failed"), expect.anything());
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

    useDashboardStore.getState().importDashboard(JSON.stringify(bad));

    expect(useDashboardStore.getState().dashboard.id).not.toBe("dash-1");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("Import failed"), expect.anything());
    spy.mockRestore();
  });

  it("accepts a dashboard with optional fields omitted", () => {
    const dashboard = makeValidDashboard();
    delete (dashboard as unknown as Record<string, unknown>).description;
    delete (dashboard as unknown as Record<string, unknown>).refreshInterval;

    useDashboardStore.getState().importDashboard(JSON.stringify(dashboard));

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

    useDashboardStore.getState().importDashboard(JSON.stringify(dashboard));

    expect(useDashboardStore.getState().dashboard.panels[0].id).toBe("p-1");
  });
});
