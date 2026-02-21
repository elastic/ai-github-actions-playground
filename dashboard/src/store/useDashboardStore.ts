import { create } from "zustand";
import { persist, type StorageValue } from "zustand/middleware";
import type {
  DashboardDefinition,
  ElasticsearchConnection,
  PanelDefinition,
  TimeRange,
} from "../types";
import { createDefaultDashboard } from "../dashboards/default";

export { createDefaultDashboard };

interface DashboardState {
  connection: ElasticsearchConnection | null;
  connected: boolean;
  dashboard: DashboardDefinition;
  themeMode: "light" | "dark";
  editingPanelId: string | null;
  connectionDialogOpen: boolean;
  currentPage: "dashboard" | "discover" | "docs";

  setConnection: (conn: ElasticsearchConnection) => void;
  setConnected: (connected: boolean) => void;
  setThemeMode: (mode: "light" | "dark") => void;
  setTimeRange: (range: TimeRange) => void;
  setRefreshInterval: (interval: number) => void;
  setDashboardTitle: (title: string) => void;

  addPanel: (panel: PanelDefinition) => void;
  updatePanel: (id: string, updates: Partial<PanelDefinition>) => void;
  removePanel: (id: string) => void;
  updatePanelLayouts: (
    layouts: Array<{ id: string; x: number; y: number; w: number; h: number }>,
  ) => void;

  setEditingPanelId: (id: string | null) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  setCurrentPage: (page: "dashboard" | "discover" | "docs") => void;

  exportDashboard: () => string;
  importDashboard: (json: string) => void;
  loadDefaultDashboard: () => void;
  resetState: () => void;
}

/**
 * Custom storage that keeps the Elasticsearch URL in localStorage (persistent)
 * while storing the API key only in sessionStorage (cleared when the browser
 * session ends, reducing the exposure window of the credential).
 */
type PersistedState = { connection?: ElasticsearchConnection | null };
const API_KEY_SESSION_SUFFIX = ":apiKey";
const PASSWORD_SESSION_SUFFIX = ":password";

const splitStorage = {
  getItem: (name: string): StorageValue<PersistedState> | null => {
    const localRaw = localStorage.getItem(name);
    if (!localRaw) return null;
    try {
      const stored = JSON.parse(localRaw) as StorageValue<PersistedState>;
      const apiKey = sessionStorage.getItem(name + API_KEY_SESSION_SUFFIX) ?? "";
      const password = sessionStorage.getItem(name + PASSWORD_SESSION_SUFFIX) ?? "";
      if (stored.state.connection) {
        stored.state.connection = { ...stored.state.connection, apiKey, password };
      }
      return stored;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: StorageValue<PersistedState>): void => {
    const apiKey = value.state.connection?.apiKey ?? "";
    const password = value.state.connection?.password ?? "";
    const toStore: StorageValue<PersistedState> = {
      ...value,
      state: {
        ...value.state,
        connection: value.state.connection
          ? { ...value.state.connection, apiKey: "", password: "" }
          : value.state.connection,
      },
    };
    localStorage.setItem(name, JSON.stringify(toStore));
    sessionStorage.setItem(name + API_KEY_SESSION_SUFFIX, apiKey);
    sessionStorage.setItem(name + PASSWORD_SESSION_SUFFIX, password);
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name + API_KEY_SESSION_SUFFIX);
    sessionStorage.removeItem(name + PASSWORD_SESSION_SUFFIX);
  },
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      connection: null,
      connected: false,
      dashboard: createDefaultDashboard(),
      themeMode: "dark",
      editingPanelId: null,
      connectionDialogOpen: false,
      currentPage: "dashboard",

      setConnection: (conn) => set({ connection: conn }),
      setConnected: (connected) => set({ connected }),
      setThemeMode: (mode) => set({ themeMode: mode }),
      setTimeRange: (range) =>
        set((s) => ({
          dashboard: { ...s.dashboard, timeRange: range, updatedAt: new Date().toISOString() },
        })),
      setRefreshInterval: (interval) =>
        set((s) => ({
          dashboard: {
            ...s.dashboard,
            refreshInterval: interval,
            updatedAt: new Date().toISOString(),
          },
        })),
      setDashboardTitle: (title) =>
        set((s) => ({
          dashboard: { ...s.dashboard, title, updatedAt: new Date().toISOString() },
        })),

      addPanel: (panel) =>
        set((s) => ({
          dashboard: {
            ...s.dashboard,
            panels: [...s.dashboard.panels, panel],
            updatedAt: new Date().toISOString(),
          },
        })),

      updatePanel: (id, updates) =>
        set((s) => ({
          dashboard: {
            ...s.dashboard,
            panels: s.dashboard.panels.map((p) => (p.id === id ? { ...p, ...updates } : p)),
            updatedAt: new Date().toISOString(),
          },
        })),

      removePanel: (id) =>
        set((s) => ({
          dashboard: {
            ...s.dashboard,
            panels: s.dashboard.panels.filter((p) => p.id !== id),
            updatedAt: new Date().toISOString(),
          },
        })),

      updatePanelLayouts: (layouts) =>
        set((s) => ({
          dashboard: {
            ...s.dashboard,
            panels: s.dashboard.panels.map((p) => {
              const layout = layouts.find((l) => l.id === p.id);
              return layout ? { ...p, layout } : p;
            }),
            updatedAt: new Date().toISOString(),
          },
        })),

      setEditingPanelId: (id) => set({ editingPanelId: id }),
      setConnectionDialogOpen: (open) => set({ connectionDialogOpen: open }),
      setCurrentPage: (page) => set({ currentPage: page }),

      exportDashboard: () => {
        const { dashboard } = get();
        return JSON.stringify(dashboard, null, 2);
      },

      importDashboard: (json) => {
        const parsed = JSON.parse(json) as DashboardDefinition;
        set({ dashboard: parsed });
      },

      loadDefaultDashboard: () => {
        set({ dashboard: createDefaultDashboard() });
      },

      resetState: () => {
        splitStorage.removeItem("esql-dashboard");
        set({
          connection: null,
          connected: false,
          dashboard: createDefaultDashboard(),
          themeMode: "dark",
          editingPanelId: null,
          connectionDialogOpen: false,
          currentPage: "dashboard",
        });
      },
    }),
    {
      name: "esql-dashboard",
      storage: splitStorage,
      partialize: (state) => ({
        connection: state.connection,
        dashboard: state.dashboard,
        themeMode: state.themeMode,
      }),
    },
  ),
);
