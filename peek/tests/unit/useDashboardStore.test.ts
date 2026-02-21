import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDashboardStore } from "../../src/store/useDashboardStore";

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
