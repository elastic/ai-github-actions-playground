import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  ConnectionProfile,
  DashboardDefinition,
  DashboardParameter,
  ElasticsearchConnection,
  PanelDefinition,
  TimeRange,
} from "../types";
import type { UserCapabilities } from "../services/es";
import type { PageId } from "../routes/manifest";
import { dashboardDefinitionSchema } from "../schemas";
import { createDefaultDashboard } from "../dashboards/default";

import { createSplitSecretStorage } from "./createSplitSecretStorage";

export { createDefaultDashboard };

interface DashboardState {
  connection: ElasticsearchConnection | null;
  connected: boolean;
  capabilities: UserCapabilities | null;
  connectionProfiles: ConnectionProfile[];
  activeProfileId: string | null;
  dashboard: DashboardDefinition;
  themeMode: "light" | "dark";
  editingPanelId: string | null;
  connectionDialogOpen: boolean;
  currentPage: PageId;
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
  setThemeMode: (mode: "light" | "dark") => void;
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

  setEditingPanelId: (id: string | null) => void;
  setConnectionDialogOpen: (open: boolean) => void;
  setCurrentPage: (page: PageId) => void;
  setDiscoverQueryDraft: (query: string | null) => void;
  appendQueryToHistory: (query: string) => void;

  addParameter: (param: DashboardParameter) => void;
  updateParameter: (name: string, updates: Partial<DashboardParameter>) => void;
  removeParameter: (name: string) => void;
  setParameterValue: (name: string, value: DashboardParameter["value"]) => void;

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
type PersistedState = {
  connection?: ElasticsearchConnection | null;
  connectionProfiles?: ConnectionProfile[];
  activeProfileId?: string | null;
};
const STORE_NAME = "elastic-peek";
const API_KEY_SESSION_SUFFIX = ":apiKey";
const PASSWORD_SESSION_SUFFIX = ":password";
const PROFILE_SESSION_PREFIX = ":profile:";
const QUERY_HISTORY_MAX_SIZE = 10;

/** Strip credentials from a connection, returning redacted copy. */
function stripCredentials(conn: ElasticsearchConnection): ElasticsearchConnection {
  return { ...conn, apiKey: "", password: "" };
}

/** Strip credentials from an array of connection profiles. */
function stripProfileCredentials(profiles: ConnectionProfile[]): ConnectionProfile[] {
  return profiles.map((p) => ({ ...p, connection: stripCredentials(p.connection) }));
}

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

const splitStorage = createSplitSecretStorage<PersistedState>({
  restoreSecrets: (name, state) => {
    const restored = { ...state };
    if (restored.connection) {
      const apiKey = sessionStorage.getItem(name + API_KEY_SESSION_SUFFIX) ?? "";
      const password = sessionStorage.getItem(name + PASSWORD_SESSION_SUFFIX) ?? "";
      restored.connection = { ...restored.connection, apiKey, password };
    }
    if (restored.connectionProfiles) {
      restored.connectionProfiles = restored.connectionProfiles.map((profile) => {
        const pApiKey =
          sessionStorage.getItem(
            name + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
          ) ?? "";
        const pPassword =
          sessionStorage.getItem(
            name + PROFILE_SESSION_PREFIX + profile.id + PASSWORD_SESSION_SUFFIX,
          ) ?? "";
        return {
          ...profile,
          connection: { ...profile.connection, apiKey: pApiKey, password: pPassword },
        };
      });
    }
    return restored;
  },
  persistSecrets: (name, state) => {
    sessionStorage.setItem(name + API_KEY_SESSION_SUFFIX, state.connection?.apiKey ?? "");
    sessionStorage.setItem(name + PASSWORD_SESSION_SUFFIX, state.connection?.password ?? "");
    for (const profile of state.connectionProfiles ?? []) {
      sessionStorage.setItem(
        name + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
        profile.connection.apiKey ?? "",
      );
      sessionStorage.setItem(
        name + PROFILE_SESSION_PREFIX + profile.id + PASSWORD_SESSION_SUFFIX,
        profile.connection.password ?? "",
      );
    }
  },
  stripSecrets: (state) => {
    const profiles = state.connectionProfiles ?? [];
    return {
      ...state,
      connection: state.connection ? stripCredentials(state.connection) : state.connection,
      connectionProfiles: profiles.length > 0 ? stripProfileCredentials(profiles) : profiles,
    };
  },
  clearSecrets: (name, localRaw) => {
    if (localRaw) {
      try {
        const stored = JSON.parse(localRaw) as { state: PersistedState };
        for (const profile of stored.state.connectionProfiles ?? []) {
          sessionStorage.removeItem(
            name + PROFILE_SESSION_PREFIX + profile.id + API_KEY_SESSION_SUFFIX,
          );
          sessionStorage.removeItem(
            name + PROFILE_SESSION_PREFIX + profile.id + PASSWORD_SESSION_SUFFIX,
          );
        }
      } catch {
        /* ignore parse errors during cleanup */
      }
    }
    sessionStorage.removeItem(name + API_KEY_SESSION_SUFFIX);
    sessionStorage.removeItem(name + PASSWORD_SESSION_SUFFIX);
  },
});

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      connection: null,
      connected: false,
      capabilities: null,
      connectionProfiles: [],
      activeProfileId: null,
      dashboard: createDefaultDashboard(),
      themeMode: "dark",
      editingPanelId: null,
      connectionDialogOpen: false,
      currentPage: "dashboard",
      discoverQueryDraft: null,
      queryHistory: [],

      setConnection: (conn) => set({ connection: conn }),
      setConnected: (connected) => set({ connected }),
      setCapabilities: (caps) => set({ capabilities: caps }),

      saveConnectionProfile: (name, connection) => {
        const { connectionProfiles } = get();
        if (connectionProfiles.some((p) => p.name === name)) return null;
        const id = crypto.randomUUID();
        const profile: ConnectionProfile = { id, name, connection: { ...connection } };
        set({ connectionProfiles: [...connectionProfiles, profile], activeProfileId: id });
        return id;
      },

      deleteConnectionProfile: (id) =>
        set((s) => {
          sessionStorage.removeItem(
            STORE_NAME + PROFILE_SESSION_PREFIX + id + API_KEY_SESSION_SUFFIX,
          );
          sessionStorage.removeItem(
            STORE_NAME + PROFILE_SESSION_PREFIX + id + PASSWORD_SESSION_SUFFIX,
          );
          const filtered = s.connectionProfiles.filter((p) => p.id !== id);
          return {
            connectionProfiles: filtered,
            activeProfileId: s.activeProfileId === id ? null : s.activeProfileId,
          };
        }),

      renameConnectionProfile: (id, name) =>
        set((s) => ({
          connectionProfiles: s.connectionProfiles.map((p) => (p.id === id ? { ...p, name } : p)),
        })),

      setActiveProfileId: (id) => set({ activeProfileId: id }),

      getConnectionProfile: (id) => {
        return get().connectionProfiles.find((p) => p.id === id);
      },

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

      setEditingPanelId: (id) => set({ editingPanelId: id }),
      setConnectionDialogOpen: (open) => set({ connectionDialogOpen: open }),
      setCurrentPage: (page) => set({ currentPage: page }),
      setDiscoverQueryDraft: (query) => set({ discoverQueryDraft: query }),
      appendQueryToHistory: (query) =>
        set((s) => {
          const trimmedQuery = query.trim();
          if (!trimmedQuery) {
            return {};
          }
          const dedupedHistory = s.queryHistory.filter((entry) => entry !== trimmedQuery);
          return {
            queryHistory: [trimmedQuery, ...dedupedHistory].slice(0, QUERY_HISTORY_MAX_SIZE),
          };
        }),

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
        splitStorage.removeItem(STORE_NAME);
        set({
          connection: null,
          connected: false,
          capabilities: null,
          connectionProfiles: [],
          activeProfileId: null,
          dashboard: createDefaultDashboard(),
          themeMode: "dark",
          editingPanelId: null,
          connectionDialogOpen: false,
          currentPage: "dashboard",
          discoverQueryDraft: null,
          queryHistory: [],
        });
      },
    }),
    {
      name: STORE_NAME,
      storage: splitStorage,
      partialize: (state) => ({
        connection: state.connection,
        connectionProfiles: state.connectionProfiles,
        activeProfileId: state.activeProfileId,
        dashboard: state.dashboard,
        themeMode: state.themeMode,
        queryHistory: state.queryHistory,
      }),
    },
  ),
);
