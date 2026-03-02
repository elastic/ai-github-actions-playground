/**
 * useDashboardStore — thin facade that composes domain slices into one store.
 *
 * The implementation is intentionally kept small here. Domain-specific logic
 * lives in focused modules that can be worked on independently:
 *   - dashboardCatalogSlice.ts  — multi-dashboard CRUD, active dashboard
 *   - dashboardEditorSlice.ts   — panels, parameters, time range editing
 *   - dashboardHistorySlice.ts  — undo/redo ring buffer
 *   - dashboardImportExport.ts  — pure import/export utility functions
 *   - dashboardStoreUtils.ts    — shared helpers (syncActiveState, etc.)
 *
 * All callers continue to import `useDashboardStore` as before; no migration
 * of existing consumers is required.
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { createDefaultDashboard } from "../dashboards/default";
import { toPersesWorkspaceSnapshot } from "../services/perses/dashboardAdapters";

import { type DashboardCatalogSlice, createDashboardCatalogSlice } from "./dashboardCatalogSlice";
import { type DashboardEditorSlice, createDashboardEditorSlice } from "./dashboardEditorSlice";
import { type DashboardHistorySlice, createDashboardHistorySlice } from "./dashboardHistorySlice";
import {
  importDashboard as importDashboardUtil,
  importWorkspace as importWorkspaceUtil,
  exportDashboard as exportDashboardUtil,
  exportWorkspace as exportWorkspaceUtil,
  hydrateWorkspaceFromPersistedState,
} from "./dashboardImportExport";
import { syncActiveState, replaceActiveDashboard } from "./dashboardStoreUtils";

export { createDefaultDashboard };
export type { HistoryEntry } from "./dashboardStoreUtils";

interface DashboardImportExportSlice {
  exportDashboard: () => string;
  exportWorkspace: () => string;
  importDashboard: (json: string) => { success: boolean; error?: string };
  importWorkspace: (json: string) => { success: boolean; error?: string };
}

interface DashboardResetSlice {
  resetWorkspaceState: () => void;
  resetDashboardState: () => void;
}

export type DashboardState = DashboardCatalogSlice &
  DashboardEditorSlice &
  DashboardHistorySlice &
  DashboardImportExportSlice &
  DashboardResetSlice;

const STORE_NAME = "elastic-peek-dashboard";

export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      (set, get, api) => ({
        ...createDashboardCatalogSlice(set, get, api),
        ...createDashboardEditorSlice(set, get, api),
        ...createDashboardHistorySlice(set, get, api),

        // -- Import / Export (delegates to pure utilities) --

        exportDashboard: () => exportDashboardUtil(get().dashboard),

        exportWorkspace: () => exportWorkspaceUtil(get().dashboards, get().activeDashboardId),

        importDashboard: (json) => {
          const result = importDashboardUtil(json);
          if (!result.success || !result.dashboard) {
            return { success: result.success, error: result.error };
          }
          const importedDashboard = result.dashboard;
          set((s) => {
            const collidesWithExisting = s.dashboards.some((d) => d.id === importedDashboard.id);
            const dashboard = collidesWithExisting
              ? { ...importedDashboard, id: crypto.randomUUID() }
              : importedDashboard;
            return {
              ...replaceActiveDashboard(s, dashboard),
              historyPast: [],
              historyFuture: [],
            };
          });
          return { success: true };
        },

        importWorkspace: (json) => {
          const result = importWorkspaceUtil(json);
          if (!result.success || !result.dashboards || !result.activeDashboardId) {
            return { success: result.success, error: result.error };
          }
          const { dashboards, activeDashboardId } = result;
          set(() => ({
            ...syncActiveState(dashboards, activeDashboardId),
            historyPast: [],
            historyFuture: [],
          }));
          return { success: true };
        },

        // -- Reset --

        resetWorkspaceState: () => {
          useDashboardStore.persist.clearStorage();
          const fresh = createDefaultDashboard();
          set({
            dashboard: fresh,
            dashboards: [fresh],
            activeDashboardId: fresh.id,
            historyPast: [],
            historyFuture: [],
          });
        },

        resetDashboardState: () => {
          get().resetWorkspaceState();
        },
      }),
      {
        name: STORE_NAME,
        version: 3,
        migrate: (persistedState, _version) => {
          void _version;
          const hydrated = hydrateWorkspaceFromPersistedState(persistedState);
          if (hydrated) {
            return {
              workspace: toPersesWorkspaceSnapshot(hydrated.dashboards, hydrated.activeDashboardId),
            };
          }
          const fresh = createDefaultDashboard();
          return {
            workspace: toPersesWorkspaceSnapshot([fresh], fresh.id),
          };
        },
        merge: (persistedState, currentState) => {
          const hydrated = hydrateWorkspaceFromPersistedState(persistedState);
          if (!hydrated) {
            return currentState;
          }
          return {
            ...currentState,
            ...syncActiveState(hydrated.dashboards, hydrated.activeDashboardId),
          };
        },
        partialize: (state) => ({
          workspace: toPersesWorkspaceSnapshot(state.dashboards, state.activeDashboardId),
        }),
      },
    ),
    { name: "DashboardStore", enabled: import.meta.env.DEV },
  ),
);
