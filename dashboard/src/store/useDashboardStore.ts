import { create } from "zustand";
import { persist } from "zustand/middleware";
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

  setConnection: (conn: ElasticsearchConnection) => void;
  setConnected: (connected: boolean) => void;
  setThemeMode: (mode: "light" | "dark") => void;
  setTimeRange: (range: TimeRange) => void;
  setDashboardTitle: (title: string) => void;

  addPanel: (panel: PanelDefinition) => void;
  updatePanel: (id: string, updates: Partial<PanelDefinition>) => void;
  removePanel: (id: string) => void;
  updatePanelLayouts: (
    layouts: Array<{ id: string; x: number; y: number; w: number; h: number }>,
  ) => void;

  setEditingPanelId: (id: string | null) => void;
  setConnectionDialogOpen: (open: boolean) => void;

  exportDashboard: () => string;
  importDashboard: (json: string) => void;
  loadDefaultDashboard: () => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      connection: null,
      connected: false,
      dashboard: createDefaultDashboard(),
      themeMode: "dark",
      editingPanelId: null,
      connectionDialogOpen: false,

      setConnection: (conn) => set({ connection: conn }),
      setConnected: (connected) => set({ connected }),
      setThemeMode: (mode) => set({ themeMode: mode }),
      setTimeRange: (range) =>
        set((s) => ({
          dashboard: { ...s.dashboard, timeRange: range, updatedAt: new Date().toISOString() },
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
    }),
    {
      name: "esql-dashboard",
      partialize: (state) => ({
        connection: state.connection,
        dashboard: state.dashboard,
        themeMode: state.themeMode,
      }),
    },
  ),
);
