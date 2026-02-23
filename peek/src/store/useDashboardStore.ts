import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { DashboardDefinition, DashboardParameter, PanelDefinition, TimeRange } from "../types";
import { dashboardDefinitionSchema } from "../schemas";
import { createDefaultDashboard } from "../dashboards/default";

export { createDefaultDashboard };

/** Maximum number of undo history entries to retain. */
const MAX_HISTORY_DEPTH = 50;

/** A single entry in the undo/redo history ring buffer. */
export interface HistoryEntry {
  dashboard: DashboardDefinition;
  label: string;
}

interface DashboardState {
  dashboard: DashboardDefinition;

  /** Undo stack — most recent action is last (session-only, not persisted). */
  historyPast: HistoryEntry[];
  /** Redo stack — next action to redo is first (session-only, not persisted). */
  historyFuture: HistoryEntry[];

  undoDashboardChange: () => void;
  redoDashboardChange: () => void;

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

/** Push the current dashboard onto the past stack, returning the updated history slices. */
function pushToHistory(
  s: Pick<DashboardState, "dashboard" | "historyPast">,
  label: string,
): Pick<DashboardState, "historyPast" | "historyFuture"> {
  return {
    historyPast: [
      ...s.historyPast.slice(-(MAX_HISTORY_DEPTH - 1)),
      { dashboard: s.dashboard, label },
    ],
    historyFuture: [],
  };
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      dashboard: createDefaultDashboard(),
      historyPast: [],
      historyFuture: [],

      undoDashboardChange: () =>
        set((s) => {
          const entry = s.historyPast[s.historyPast.length - 1];
          if (!entry) return {};
          return {
            dashboard: entry.dashboard,
            historyPast: s.historyPast.slice(0, -1),
            historyFuture: [{ dashboard: s.dashboard, label: entry.label }, ...s.historyFuture],
          };
        }),

      redoDashboardChange: () =>
        set((s) => {
          const entry = s.historyFuture[0];
          if (!entry) return {};
          return {
            dashboard: entry.dashboard,
            historyPast: [...s.historyPast, { dashboard: s.dashboard, label: entry.label }],
            historyFuture: s.historyFuture.slice(1),
          };
        }),

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
          ...pushToHistory(s, "Renamed dashboard"),
          dashboard: { ...s.dashboard, title, updatedAt: new Date().toISOString() },
        })),

      addPanel: (panel) =>
        set((s) => ({
          ...pushToHistory(s, `Added panel "${panel.title}"`),
          dashboard: {
            ...s.dashboard,
            panels: [...s.dashboard.panels, panel],
            updatedAt: new Date().toISOString(),
          },
        })),

      updatePanel: (id, updates) =>
        set((s) => {
          const panel = s.dashboard.panels.find((p) => p.id === id);
          const label = panel ? `Updated panel "${panel.title}"` : "Updated panel";
          return {
            ...pushToHistory(s, label),
            dashboard: {
              ...s.dashboard,
              panels: s.dashboard.panels.map((p) => (p.id === id ? { ...p, ...updates } : p)),
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      removePanel: (id) =>
        set((s) => {
          const panel = s.dashboard.panels.find((p) => p.id === id);
          const label = panel ? `Removed panel "${panel.title}"` : "Removed panel";
          return {
            ...pushToHistory(s, label),
            dashboard: {
              ...s.dashboard,
              panels: s.dashboard.panels.filter((p) => p.id !== id),
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      duplicatePanel: (id) => {
        let newId: string | null = null;
        set((s) => {
          const source = s.dashboard.panels.find((p) => p.id === id);
          if (!source) return {};
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
            ...pushToHistory(s, `Duplicated panel "${source.title}"`),
            dashboard: {
              ...s.dashboard,
              panels: [...s.dashboard.panels, clone],
              updatedAt: new Date().toISOString(),
            },
          };
        });
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
          set({ dashboard: result.data, historyPast: [], historyFuture: [] });
          return { success: true };
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          console.error("Import failed: invalid JSON", error);
          return { success: false, error };
        }
      },

      loadDefaultDashboard: () => {
        set({ dashboard: createDefaultDashboard(), historyPast: [], historyFuture: [] });
      },

      resetDashboardState: () => {
        localStorage.removeItem(STORE_NAME);
        set({ dashboard: createDefaultDashboard(), historyPast: [], historyFuture: [] });
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
