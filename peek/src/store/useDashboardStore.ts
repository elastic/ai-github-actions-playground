import { create } from "zustand";
import { persist, type StorageValue } from "zustand/middleware";
import type {
  DashboardDefinition,
  DashboardParameter,
  ElasticsearchConnection,
  PanelDefinition,
  TimeRange,
} from "../types";
import type { UserCapabilities } from "../services/es";
import { dashboardDefinitionSchema } from "../schemas";
import { createDefaultDashboard } from "../dashboards/default";

export { createDefaultDashboard };

interface DashboardState {
  connection: ElasticsearchConnection | null;
  connected: boolean;
  capabilities: UserCapabilities | null;
  dashboard: DashboardDefinition;
  themeMode: "light" | "dark";
  editingPanelId: string | null;
  connectionDialogOpen: boolean;
  currentPage: "dashboard" | "discover" | "dataStreams" | "docs";
  discoverQueryDraft: string | null;

  setConnection: (conn: ElasticsearchConnection) => void;
  setConnected: (connected: boolean) => void;
  setCapabilities: (caps: UserCapabilities | null) => void;
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
  setCurrentPage: (page: "dashboard" | "discover" | "dataStreams" | "docs") => void;
  setDiscoverQueryDraft: (query: string | null) => void;

  addParameter: (param: DashboardParameter) => void;
  updateParameter: (name: string, updates: Partial<DashboardParameter>) => void;
  removeParameter: (name: string) => void;
  setParameterValue: (name: string, value: string) => void;

  exportDashboard: () => string;
  importDashboard: (json: string) => { success: boolean; error?: string };
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
      capabilities: null,
      dashboard: createDefaultDashboard(),
      themeMode: "dark",
      editingPanelId: null,
      connectionDialogOpen: false,
      currentPage: "dashboard",
      discoverQueryDraft: null,

      setConnection: (conn) => set({ connection: conn }),
      setConnected: (connected) => set({ connected }),
      setCapabilities: (caps) => set({ capabilities: caps }),
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
      setDiscoverQueryDraft: (query) => set({ discoverQueryDraft: query }),

      addParameter: (param) =>
        set((s) => ({
          dashboard: {
            ...s.dashboard,
            parameters: [
              ...(s.dashboard.parameters ?? []).filter((existing) => existing.name !== param.name),
              param,
            ],
            updatedAt: new Date().toISOString(),
          },
        })),

      updateParameter: (name, updates) =>
        set((s) => {
          const parameters = s.dashboard.parameters ?? [];
          const target = parameters.find((p) => p.name === name);
          if (!target) {
            return { dashboard: s.dashboard };
          }
          const nextName = updates.name ?? name;
          const next = { ...target, ...updates, name: nextName };
          return {
            dashboard: {
              ...s.dashboard,
              parameters: [
                ...parameters.filter((p) => p.name !== name && p.name !== nextName),
                next,
              ],
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      removeParameter: (name) =>
        set((s) => ({
          dashboard: {
            ...s.dashboard,
            parameters: (s.dashboard.parameters ?? []).filter((p) => p.name !== name),
            updatedAt: new Date().toISOString(),
          },
        })),

      setParameterValue: (name, value) =>
        set((s) => {
          const parameters = s.dashboard.parameters ?? [];
          const target = parameters.find((p) => p.name === name);
          if (!target || target.value === value) {
            return { dashboard: s.dashboard };
          }
          return {
            dashboard: {
              ...s.dashboard,
              parameters: parameters.map((p) => (p.name === name ? { ...p, value } : p)),
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      exportDashboard: () => {
        const { dashboard } = get();
        return JSON.stringify(dashboard, null, 2);
      },

      importDashboard: (json) => {
        try {
          const result = dashboardDefinitionSchema.safeParse(JSON.parse(json));
          if (!result.success) {
            const error = result.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ");
            console.error("Import failed:", error);
            return { success: false, error };
          }
          set({ dashboard: result.data as DashboardDefinition });
          return { success: true };
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          console.error("Import failed: invalid JSON", error);
          return { success: false, error };
        }
      },

      loadDefaultDashboard: () => {
        set({ dashboard: createDefaultDashboard() });
      },

      resetState: () => {
        splitStorage.removeItem("elastic-peek");
        set({
          connection: null,
          connected: false,
          capabilities: null,
          dashboard: createDefaultDashboard(),
          themeMode: "dark",
          editingPanelId: null,
          connectionDialogOpen: false,
          currentPage: "dashboard",
          discoverQueryDraft: null,
        });
      },
    }),
    {
      name: "elastic-peek",
      storage: splitStorage,
      partialize: (state) => ({
        connection: state.connection,
        dashboard: state.dashboard,
        themeMode: state.themeMode,
      }),
    },
  ),
);
