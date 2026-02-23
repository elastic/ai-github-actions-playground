import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { DashboardDefinition, DashboardParameter, PanelDefinition, TimeRange } from "../types";
import { dashboardDefinitionSchema, workspaceSnapshotSchema } from "../schemas";
import { createDefaultDashboard } from "../dashboards/default";

export { createDefaultDashboard };

interface DashboardState {
  dashboard: DashboardDefinition;
  dashboards: DashboardDefinition[];
  activeDashboardId: string;

  setActiveDashboard: (id: string) => void;
  createDashboard: (title?: string) => string;
  renameDashboard: (id: string, title: string) => void;
  duplicateDashboard: (id: string) => string | null;
  archiveDashboard: (id: string, archived: boolean) => void;
  deleteDashboard: (id: string) => boolean;
  restoreDashboard: (dashboard: DashboardDefinition, makeActive?: boolean) => void;

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
  exportWorkspace: () => string;
  importDashboard: (json: string) => { success: boolean; error?: string };
  importWorkspace: (json: string) => { success: boolean; error?: string };
  loadDefaultDashboard: () => void;
  resetWorkspaceState: () => void;
  resetDashboardState: () => void;
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

function getNextDuplicatedDashboardTitle(sourceTitle: string, existingTitles: string[]): string {
  const baseTitle = sourceTitle.replace(/\s*\(copy(?:\s*\d+)?\)$/i, "").trim() || "Dashboard";
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

function nowIso(): string {
  return new Date().toISOString();
}

function getActiveDashboard(
  state: Pick<DashboardState, "dashboard" | "dashboards" | "activeDashboardId">,
) {
  return state.dashboards.find((d) => d.id === state.activeDashboardId) ?? state.dashboard;
}

function syncActiveState(
  dashboards: DashboardDefinition[],
  activeDashboardId: string,
): Pick<DashboardState, "dashboard" | "dashboards" | "activeDashboardId"> {
  const active =
    dashboards.find((d) => d.id === activeDashboardId) ?? dashboards[0] ?? createDefaultDashboard();
  return {
    dashboard: active,
    dashboards,
    activeDashboardId: active.id,
  };
}

function replaceActiveDashboard(
  state: Pick<DashboardState, "dashboard" | "dashboards" | "activeDashboardId">,
  nextActive: DashboardDefinition,
): Pick<DashboardState, "dashboard" | "dashboards" | "activeDashboardId"> {
  const idx = state.dashboards.findIndex((d) => d.id === state.activeDashboardId);
  const dashboards = [...state.dashboards];
  if (idx >= 0) {
    dashboards[idx] = nextActive;
  } else {
    dashboards.push(nextActive);
  }
  return syncActiveState(dashboards, nextActive.id);
}

const initialDashboard = createDefaultDashboard();

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      dashboard: initialDashboard,
      dashboards: [initialDashboard],
      activeDashboardId: initialDashboard.id,

      setActiveDashboard: (id) =>
        set((s) => {
          if (!s.dashboards.some((dashboard) => dashboard.id === id)) {
            return {};
          }
          return syncActiveState(s.dashboards, id);
        }),

      createDashboard: (title) => {
        const trimmed = title?.trim();
        const timestamp = nowIso();
        const id = crypto.randomUUID();
        const next: DashboardDefinition = {
          ...createDefaultDashboard(),
          id,
          title:
            trimmed && trimmed.length > 0 ? trimmed : `Dashboard ${get().dashboards.length + 1}`,
          description: "",
          panels: [],
          parameters: [],
          archived: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((s) => syncActiveState([...s.dashboards, next], id));
        return id;
      },

      renameDashboard: (id, title) =>
        set((s) => {
          const nextTitle = title.trim();
          if (!nextTitle) return {};
          const dashboards = s.dashboards.map((dashboard) =>
            dashboard.id === id
              ? { ...dashboard, title: nextTitle, updatedAt: nowIso() }
              : dashboard,
          );
          return syncActiveState(dashboards, s.activeDashboardId);
        }),

      duplicateDashboard: (id) => {
        const state = get();
        const source = state.dashboards.find((dashboard) => dashboard.id === id);
        if (!source) return null;
        const timestamp = nowIso();
        const clone: DashboardDefinition = {
          ...structuredClone(source),
          id: crypto.randomUUID(),
          title: getNextDuplicatedDashboardTitle(
            source.title,
            state.dashboards.map((dashboard) => dashboard.title),
          ),
          archived: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((s) => syncActiveState([...s.dashboards, clone], clone.id));
        return clone.id;
      },

      archiveDashboard: (id, archived) =>
        set((s) => {
          const dashboards = s.dashboards.map((dashboard) =>
            dashboard.id === id ? { ...dashboard, archived, updatedAt: nowIso() } : dashboard,
          );
          return syncActiveState(dashboards, s.activeDashboardId);
        }),

      deleteDashboard: (id) => {
        const state = get();
        if (state.dashboards.length <= 1) return false;
        const dashboards = state.dashboards.filter((dashboard) => dashboard.id !== id);
        if (dashboards.length === state.dashboards.length) return false;
        const nextActiveId =
          state.activeDashboardId === id
            ? (dashboards[0]?.id ?? state.activeDashboardId)
            : state.activeDashboardId;
        set(() => syncActiveState(dashboards, nextActiveId));
        return true;
      },

      restoreDashboard: (dashboard, makeActive = false) =>
        set((s) => {
          const existing = s.dashboards.some((entry) => entry.id === dashboard.id);
          if (existing) {
            return makeActive ? syncActiveState(s.dashboards, dashboard.id) : {};
          }
          const dashboards = [...s.dashboards, dashboard];
          return syncActiveState(dashboards, makeActive ? dashboard.id : s.activeDashboardId);
        }),

      setTimeRange: (range) =>
        set((s) => {
          const active = getActiveDashboard(s);
          return replaceActiveDashboard(s, { ...active, timeRange: range, updatedAt: nowIso() });
        }),

      setRefreshInterval: (interval) =>
        set((s) => {
          const active = getActiveDashboard(s);
          return replaceActiveDashboard(s, {
            ...active,
            refreshInterval: interval,
            updatedAt: nowIso(),
          });
        }),

      setDashboardTitle: (title) =>
        set((s) => {
          const active = getActiveDashboard(s);
          return replaceActiveDashboard(s, { ...active, title, updatedAt: nowIso() });
        }),

      addPanel: (panel) =>
        set((s) => {
          const active = getActiveDashboard(s);
          return replaceActiveDashboard(s, {
            ...active,
            panels: [...active.panels, panel],
            updatedAt: nowIso(),
          });
        }),

      updatePanel: (id, updates) =>
        set((s) => {
          const active = getActiveDashboard(s);
          return replaceActiveDashboard(s, {
            ...active,
            panels: active.panels.map((panel) =>
              panel.id === id ? { ...panel, ...updates } : panel,
            ),
            updatedAt: nowIso(),
          });
        }),

      removePanel: (id) =>
        set((s) => {
          const active = getActiveDashboard(s);
          return replaceActiveDashboard(s, {
            ...active,
            panels: active.panels.filter((panel) => panel.id !== id),
            updatedAt: nowIso(),
          });
        }),

      duplicatePanel: (id) => {
        let newId: string | null = null;
        set((s) => {
          const active = getActiveDashboard(s);
          const source = active.panels.find((panel) => panel.id === id);
          if (!source) return {};
          const nextId = crypto.randomUUID();
          const clone: PanelDefinition = {
            ...structuredClone(source),
            id: nextId,
            title: getNextDuplicatedPanelTitle(
              source.title,
              active.panels.map((panel) => panel.title),
            ),
            layout: { ...source.layout, y: Infinity },
          };
          newId = nextId;
          return replaceActiveDashboard(s, {
            ...active,
            panels: [...active.panels, clone],
            updatedAt: nowIso(),
          });
        });
        return newId;
      },

      updatePanelLayouts: (layouts) =>
        set((s) => {
          const active = getActiveDashboard(s);
          return replaceActiveDashboard(s, {
            ...active,
            panels: active.panels.map((panel) => {
              const layout = layouts.find((entry) => entry.id === panel.id);
              return layout ? { ...panel, layout } : panel;
            }),
            updatedAt: nowIso(),
          });
        }),

      addParameter: (param) =>
        set((s) => {
          const active = getActiveDashboard(s);
          return replaceActiveDashboard(s, {
            ...active,
            parameters: [
              ...(active.parameters ?? []).filter((existing) => existing.name !== param.name),
              param,
            ],
            updatedAt: nowIso(),
          });
        }),

      updateParameter: (name, updates) =>
        set((s) => {
          const active = getActiveDashboard(s);
          const parameters = active.parameters ?? [];
          const target = parameters.find((parameter) => parameter.name === name);
          if (!target) {
            return {};
          }
          const nextName = updates.name ?? name;
          const next = { ...target, ...updates, name: nextName };
          return replaceActiveDashboard(s, {
            ...active,
            parameters: [
              ...parameters.filter(
                (parameter) => parameter.name !== name && parameter.name !== nextName,
              ),
              next,
            ],
            updatedAt: nowIso(),
          });
        }),

      removeParameter: (name) =>
        set((s) => {
          const active = getActiveDashboard(s);
          return replaceActiveDashboard(s, {
            ...active,
            parameters: (active.parameters ?? []).filter((parameter) => parameter.name !== name),
            updatedAt: nowIso(),
          });
        }),

      setParameterValue: (name, value) =>
        set((s) => {
          const active = getActiveDashboard(s);
          const parameters = active.parameters ?? [];
          const target = parameters.find((parameter) => parameter.name === name);
          if (!target || target.value === value) {
            return {};
          }
          return replaceActiveDashboard(s, {
            ...active,
            parameters: parameters.map((parameter) =>
              parameter.name === name ? { ...parameter, value } : parameter,
            ),
            updatedAt: nowIso(),
          });
        }),

      exportDashboard: () => {
        const { dashboard } = get();
        return JSON.stringify(dashboard, null, 2);
      },

      exportWorkspace: () => {
        const { dashboards, activeDashboardId } = get();
        return JSON.stringify({ dashboards, activeDashboardId }, null, 2);
      },

      importDashboard: (json) => {
        try {
          const result = dashboardDefinitionSchema.safeParse(JSON.parse(json));
          if (!result.success) {
            const error = result.error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; ");
            console.error("Import failed:", error);
            return { success: false, error };
          }
          set((s) => replaceActiveDashboard(s, result.data));
          return { success: true };
        } catch (errorLike) {
          const error = errorLike instanceof Error ? errorLike.message : String(errorLike);
          console.error("Import failed: invalid JSON", error);
          return { success: false, error };
        }
      },

      importWorkspace: (json) => {
        try {
          const result = workspaceSnapshotSchema.safeParse(JSON.parse(json));
          if (!result.success) {
            const error = result.error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; ");
            console.error("Workspace import failed:", error);
            return { success: false, error };
          }
          const { dashboards, activeDashboardId } = result.data;
          if (!dashboards.some((dashboard) => dashboard.id === activeDashboardId)) {
            const error = "activeDashboardId does not match any dashboard in the workspace";
            console.error("Workspace import failed:", error);
            return { success: false, error };
          }
          set(() => syncActiveState(dashboards, activeDashboardId));
          return { success: true };
        } catch (errorLike) {
          const error = errorLike instanceof Error ? errorLike.message : String(errorLike);
          console.error("Workspace import failed: invalid JSON", error);
          return { success: false, error };
        }
      },

      loadDefaultDashboard: () => {
        set((s) => replaceActiveDashboard(s, createDefaultDashboard()));
      },

      resetWorkspaceState: () => {
        localStorage.removeItem(STORE_NAME);
        const fresh = createDefaultDashboard();
        set({
          dashboard: fresh,
          dashboards: [fresh],
          activeDashboardId: fresh.id,
        });
      },

      resetDashboardState: () => {
        get().resetWorkspaceState();
      },
    }),
    {
      name: STORE_NAME,
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as Partial<DashboardState> | undefined;
        if (!state) return persistedState;
        if (Array.isArray(state.dashboards) && typeof state.activeDashboardId === "string") {
          return persistedState;
        }
        if (state.dashboard) {
          return {
            ...state,
            dashboards: [state.dashboard],
            activeDashboardId: state.dashboard.id,
          };
        }
        const fresh = createDefaultDashboard();
        return {
          dashboard: fresh,
          dashboards: [fresh],
          activeDashboardId: fresh.id,
        };
      },
      partialize: (state) => ({
        dashboard: state.dashboard,
        dashboards: state.dashboards,
        activeDashboardId: state.activeDashboardId,
      }),
    },
  ),
);
