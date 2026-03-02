/**
 * Dashboard editor slice — active dashboard content operations.
 *
 * Manages panels, parameters, time range, refresh interval, time zone,
 * and dashboard title for the currently-active dashboard. Mutations that
 * should be undoable push history entries via helpers from
 * `dashboardStoreUtils.ts`.
 */

import type { StateCreator } from "zustand";

import type { DashboardParameter, PanelDefinition, TimeRange } from "../types";
import { createDefaultDashboard } from "../dashboards/default";

import {
  type DashboardStoreSharedState,
  getActiveDashboard,
  getNextDuplicatedPanelTitle,
  nowIso,
  pushToHistory,
  replaceActiveDashboard,
} from "./dashboardStoreUtils";

export interface DashboardEditorSlice {
  setTimeRange: (range: TimeRange) => void;
  setRefreshInterval: (interval: number) => void;
  setTimeZone: (tz: string | undefined) => void;
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

  loadDefaultDashboard: () => void;
}

export const createDashboardEditorSlice: StateCreator<
  DashboardEditorSlice & DashboardStoreSharedState,
  [],
  [],
  DashboardEditorSlice
> = (set) => ({
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

  setTimeZone: (tz) =>
    set((s) => {
      const active = getActiveDashboard(s);
      return replaceActiveDashboard(s, {
        ...active,
        timeZone: tz || undefined,
        updatedAt: nowIso(),
      });
    }),

  setDashboardTitle: (title) =>
    set((s) => {
      const active = getActiveDashboard(s);
      return {
        ...pushToHistory(s, "Renamed dashboard"),
        ...replaceActiveDashboard(s, { ...active, title, updatedAt: nowIso() }),
      };
    }),

  addPanel: (panel) =>
    set((s) => {
      const active = getActiveDashboard(s);
      return {
        ...pushToHistory(s, `Added panel "${panel.title}"`),
        ...replaceActiveDashboard(s, {
          ...active,
          panels: [...active.panels, panel],
          updatedAt: nowIso(),
        }),
      };
    }),

  updatePanel: (id, updates) =>
    set((s) => {
      const active = getActiveDashboard(s);
      const panel = active.panels.find((p) => p.id === id);
      const label = panel ? `Updated panel "${updates.title ?? panel.title}"` : "Updated panel";
      return {
        ...pushToHistory(s, label),
        ...replaceActiveDashboard(s, {
          ...active,
          panels: active.panels.map((p) => (p.id === id ? { ...p, ...updates } : p)),
          updatedAt: nowIso(),
        }),
      };
    }),

  removePanel: (id) =>
    set((s) => {
      const active = getActiveDashboard(s);
      const panel = active.panels.find((p) => p.id === id);
      const label = panel ? `Removed panel "${panel.title}"` : "Removed panel";
      return {
        ...pushToHistory(s, label),
        ...replaceActiveDashboard(s, {
          ...active,
          panels: active.panels.filter((p) => p.id !== id),
          updatedAt: nowIso(),
        }),
      };
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
      return {
        ...pushToHistory(s, `Duplicated panel "${source.title}"`),
        ...replaceActiveDashboard(s, {
          ...active,
          panels: [...active.panels, clone],
          updatedAt: nowIso(),
        }),
      };
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
      return {
        ...pushToHistory(s, `Added parameter "${param.name}"`),
        ...replaceActiveDashboard(s, {
          ...active,
          parameters: [
            ...(active.parameters ?? []).filter((existing) => existing.name !== param.name),
            param,
          ],
          updatedAt: nowIso(),
        }),
      };
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
      return {
        ...pushToHistory(s, `Updated parameter "${nextName}"`),
        ...replaceActiveDashboard(s, {
          ...active,
          parameters: [
            ...parameters.filter(
              (parameter) => parameter.name !== name && parameter.name !== nextName,
            ),
            next,
          ],
          updatedAt: nowIso(),
        }),
      };
    }),

  removeParameter: (name) =>
    set((s) => {
      const active = getActiveDashboard(s);
      return {
        ...pushToHistory(s, `Removed parameter "${name}"`),
        ...replaceActiveDashboard(s, {
          ...active,
          parameters: (active.parameters ?? []).filter((parameter) => parameter.name !== name),
          updatedAt: nowIso(),
        }),
      };
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

  loadDefaultDashboard: () => {
    set((s) => {
      const active = getActiveDashboard(s);
      const defaults = createDefaultDashboard();
      return {
        ...replaceActiveDashboard(s, {
          ...defaults,
          id: active.id,
          createdAt: active.createdAt,
          updatedAt: nowIso(),
        }),
        historyPast: [],
        historyFuture: [],
      };
    });
  },
});
