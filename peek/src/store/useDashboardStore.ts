import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  ConnectionProfile,
  DashboardDefinition,
  DashboardParameter,
  ElasticsearchConnection,
  PanelDefinition,
  ProfileHealth,
  TimeRange,
} from "../types";
import type { UserCapabilities } from "../services/es";
import { dashboardDefinitionSchema } from "../schemas";
import { createDefaultDashboard } from "../dashboards/default";

import { useConnectionStore } from "./useConnectionStore";
import { useUIStore } from "./useUIStore";
import { useQueryStore } from "./useQueryStore";

export { createDefaultDashboard };

interface DashboardState {
  dashboard: DashboardDefinition;

  // Compatibility fields while consumers migrate to domain stores.
  connection: ElasticsearchConnection | null;
  connected: boolean;
  capabilities: UserCapabilities | null;
  connectionProfiles: ConnectionProfile[];
  activeProfileId: string | null;
  profileHealthMap: Record<string, ProfileHealth>;
  themeMode: "light" | "dark";
  editingPanelId: string | null;
  connectionDialogOpen: boolean;
  commandPaletteOpen: boolean;
  discoverQueryDraft: string | null;
  queryHistory: string[];

  setConnection: (conn: ElasticsearchConnection) => void;
  setConnected: (connected: boolean) => void;
  setCapabilities: (caps: UserCapabilities | null) => void;
  saveConnectionProfile: (name: string, connection: ElasticsearchConnection) => string | null;
  deleteConnectionProfile: (id: string) => void;
  renameConnectionProfile: (id: string, name: string) => void;
  setActiveProfileId: (id: string | null) => void;
  getConnectionProfile: (id: string) => ConnectionProfile | undefined;
  setProfileHealth: (id: string, health: ProfileHealth) => void;
  setThemeMode: (mode: "light" | "dark") => void;
  setEditingPanelId: (id: string | null) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setDiscoverQueryDraft: (query: string | null) => void;
  appendQueryToHistory: (query: string) => void;

  setTimeRange: (range: TimeRange) => void;
  setRefreshInterval: (interval: number) => void;
  setDashboardTitle: (title: string) => void;

  addPanel: (panel: PanelDefinition) => void;
  updatePanel: (id: string, updates: Partial<PanelDefinition>) => void;
  removePanel: (id: string) => void;
  duplicatePanel: (id: string) => string | null;
  updatePanelLayouts: (
    layouts: Array<{ id: string; x: number; y: number; w: number; h: number }>,
  ) => void;

  addParameter: (param: DashboardParameter) => void;
  updateParameter: (name: string, updates: Partial<DashboardParameter>) => void;
  removeParameter: (name: string) => void;
  setParameterValue: (name: string, value: DashboardParameter["value"]) => void;

  exportDashboard: () => string;
  importDashboard: (json: string) => { success: boolean; error?: string };
  loadDefaultDashboard: () => void;
  resetDashboardState: () => void;
  resetState: () => void;
}

const STORE_NAME = "elastic-peek-dashboard";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getNextDuplicatedPanelTitle(sourceTitle: string, existingTitles: string[]): string {
  const baseTitle = sourceTitle.replace(/\s*\(copy(?:\s*\d+)?\)$/i, "").trim() || "Panel";
  const copyTitleRegex = new RegExp(
    `^${escapeRegex(baseTitle)}\\s*\\(copy(?:\\s*(\\d+))?\\)$`,
    "i",
  );
  let maxCopyNumber = 0;
  for (const title of existingTitles) {
    const match = title.match(copyTitleRegex);
    if (!match) continue;
    const copyNumber = match[1] ? Number(match[1]) : 1;
    if (Number.isFinite(copyNumber)) {
      maxCopyNumber = Math.max(maxCopyNumber, copyNumber);
    }
  }
  return maxCopyNumber === 0 ? `${baseTitle} (copy)` : `${baseTitle} (copy ${maxCopyNumber + 1})`;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      dashboard: createDefaultDashboard(),

      get connection() {
        return useConnectionStore.getState().connection;
      },
      get connected() {
        return useConnectionStore.getState().connected;
      },
      get capabilities() {
        return useConnectionStore.getState().capabilities;
      },
      get connectionProfiles() {
        return useConnectionStore.getState().connectionProfiles;
      },
      get activeProfileId() {
        return useConnectionStore.getState().activeProfileId;
      },
      get profileHealthMap() {
        return useConnectionStore.getState().profileHealthMap;
      },
      get themeMode() {
        return useUIStore.getState().themeMode;
      },
      get editingPanelId() {
        return useUIStore.getState().editingPanelId;
      },
      get connectionDialogOpen() {
        return useUIStore.getState().connectionDialogOpen;
      },
      get commandPaletteOpen() {
        return useUIStore.getState().commandPaletteOpen;
      },
      get discoverQueryDraft() {
        return useQueryStore.getState().discoverQueryDraft;
      },
      get queryHistory() {
        return useQueryStore.getState().queryHistory;
      },

      setConnection: (conn) => useConnectionStore.getState().setConnection(conn),
      setConnected: (connected) => useConnectionStore.getState().setConnected(connected),
      setCapabilities: (caps) => useConnectionStore.getState().setCapabilities(caps),
      saveConnectionProfile: (name, connection) =>
        useConnectionStore.getState().saveConnectionProfile(name, connection),
      deleteConnectionProfile: (id) => useConnectionStore.getState().deleteConnectionProfile(id),
      renameConnectionProfile: (id, name) =>
        useConnectionStore.getState().renameConnectionProfile(id, name),
      setActiveProfileId: (id) => useConnectionStore.getState().setActiveProfileId(id),
      getConnectionProfile: (id) => useConnectionStore.getState().getConnectionProfile(id),
      setProfileHealth: (id, health) =>
        useConnectionStore.getState().setProfileHealth(id, health),
      setThemeMode: (mode) => useUIStore.getState().setThemeMode(mode),
      setEditingPanelId: (id) => useUIStore.getState().setEditingPanelId(id),
      setConnectionDialogOpen: (open) => useUIStore.getState().setConnectionDialogOpen(open),
      setCommandPaletteOpen: (open) => useUIStore.getState().setCommandPaletteOpen(open),
      setDiscoverQueryDraft: (query) => useQueryStore.getState().setDiscoverQueryDraft(query),
      appendQueryToHistory: (query) => useQueryStore.getState().appendQueryToHistory(query),

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

      duplicatePanel: (id) => {
        let newId: string | null = null;
        set((s) => ({
          dashboard: (() => {
            const source = s.dashboard.panels.find((p) => p.id === id);
            if (!source) return s.dashboard;
            const nextId = crypto.randomUUID();
            const clone: PanelDefinition = {
              ...structuredClone(source),
              id: nextId,
              title: getNextDuplicatedPanelTitle(
                source.title,
                s.dashboard.panels.map((panel) => panel.title),
              ),
              layout: { ...source.layout, y: Infinity },
            };
            newId = nextId;
            return {
              ...s.dashboard,
              panels: [...s.dashboard.panels, clone],
              updatedAt: new Date().toISOString(),
            };
          })(),
        }));
        return newId;
      },

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
          set({ dashboard: result.data });
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

      resetDashboardState: () => {
        localStorage.removeItem(STORE_NAME);
        set({ dashboard: createDefaultDashboard() });
      },

      resetState: () => {
        useConnectionStore.getState().resetConnectionState();
        useUIStore.getState().resetUIState();
        useQueryStore.getState().resetQueryState();
        localStorage.removeItem(STORE_NAME);
        set({ dashboard: createDefaultDashboard() });
      },
    }),
    {
      name: STORE_NAME,
      partialize: (state) => ({
        dashboard: state.dashboard,
      }),
    },
  ),
);
