/**
 * Dashboard catalog slice — multi-dashboard CRUD operations.
 *
 * Handles creating, renaming, duplicating, archiving, favoriting,
 * deleting, and restoring dashboards, as well as switching the active
 * dashboard. Shared helper functions live in `dashboardStoreUtils.ts`.
 */

import type { StateCreator } from "zustand";

import type { DashboardDefinition } from "../types";
import { createDefaultDashboard } from "../dashboards/default";

import {
  type DashboardStoreSharedState,
  getNextDuplicatedDashboardTitle,
  nowIso,
  syncActiveState,
} from "./dashboardStoreUtils";

export interface DashboardCatalogSlice {
  dashboard: DashboardDefinition;
  dashboards: DashboardDefinition[];
  activeDashboardId: string;

  setActiveDashboard: (id: string) => void;
  createDashboard: (title?: string) => string;
  renameDashboard: (id: string, title: string) => void;
  updateDashboardMetadata: (
    id: string,
    metadata: { description?: string; tags?: string[] },
  ) => void;
  duplicateDashboard: (id: string) => string | null;
  archiveDashboard: (id: string, archived: boolean) => void;
  toggleFavoriteDashboard: (id: string) => void;
  deleteDashboard: (id: string) => boolean;
  restoreDashboard: (dashboard: DashboardDefinition, makeActive?: boolean) => void;
}

const initialDashboard = createDefaultDashboard();

export const createDashboardCatalogSlice: StateCreator<
  DashboardCatalogSlice & DashboardStoreSharedState,
  [],
  [],
  DashboardCatalogSlice
> = (set, get) => ({
  dashboard: initialDashboard,
  dashboards: [initialDashboard],
  activeDashboardId: initialDashboard.id,

  setActiveDashboard: (id) =>
    set((s) => {
      if (!s.dashboards.some((dashboard) => dashboard.id === id)) {
        return {};
      }
      return { ...syncActiveState(s.dashboards, id), historyPast: [], historyFuture: [] };
    }),

  createDashboard: (title) => {
    const trimmed = title?.trim();
    const timestamp = nowIso();
    const id = crypto.randomUUID();
    const next: DashboardDefinition = {
      ...createDefaultDashboard(),
      id,
      title: trimmed && trimmed.length > 0 ? trimmed : `Dashboard ${get().dashboards.length + 1}`,
      description: "",
      panels: [],
      parameters: [],
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    set((s) => ({
      ...syncActiveState([...s.dashboards, next], id),
      historyPast: [],
      historyFuture: [],
    }));
    return id;
  },

  renameDashboard: (id, title) =>
    set((s) => {
      const nextTitle = title.trim();
      if (!nextTitle) return {};
      if (!s.dashboards.some((dashboard) => dashboard.id === id)) return {};
      const dashboards = s.dashboards.map((dashboard) =>
        dashboard.id === id ? { ...dashboard, title: nextTitle, updatedAt: nowIso() } : dashboard,
      );
      return syncActiveState(dashboards, s.activeDashboardId);
    }),

  updateDashboardMetadata: (id, metadata) =>
    set((s) => {
      if (!s.dashboards.some((dashboard) => dashboard.id === id)) return {};
      const dashboards = s.dashboards.map((dashboard) =>
        dashboard.id === id ? { ...dashboard, ...metadata, updatedAt: nowIso() } : dashboard,
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
    set((s) => ({
      ...syncActiveState([...s.dashboards, clone], clone.id),
      historyPast: [],
      historyFuture: [],
    }));
    return clone.id;
  },

  archiveDashboard: (id, archived) =>
    set((s) => {
      if (!s.dashboards.some((dashboard) => dashboard.id === id)) return {};
      const dashboards = s.dashboards.map((dashboard) =>
        dashboard.id === id ? { ...dashboard, archived, updatedAt: nowIso() } : dashboard,
      );
      return syncActiveState(dashboards, s.activeDashboardId);
    }),

  toggleFavoriteDashboard: (id) =>
    set((s) => {
      if (!s.dashboards.some((dashboard) => dashboard.id === id)) return {};
      const dashboards = s.dashboards.map((dashboard) =>
        dashboard.id === id
          ? {
              ...dashboard,
              favoritedAt: dashboard.favoritedAt ? undefined : nowIso(),
              updatedAt: nowIso(),
            }
          : dashboard,
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
    set(() => ({
      ...syncActiveState(dashboards, nextActiveId),
      historyPast: [],
      historyFuture: [],
    }));
    return true;
  },

  restoreDashboard: (dashboard, makeActive = false) =>
    set((s) => {
      const existing = s.dashboards.some((entry) => entry.id === dashboard.id);
      if (existing) {
        return makeActive
          ? {
              ...syncActiveState(s.dashboards, dashboard.id),
              historyPast: [],
              historyFuture: [],
            }
          : {};
      }
      const dashboards = [...s.dashboards, dashboard];
      const nextActive = makeActive ? dashboard.id : s.activeDashboardId;
      return {
        ...syncActiveState(dashboards, nextActive),
        ...(makeActive ? { historyPast: [], historyFuture: [] } : {}),
      };
    }),
});
