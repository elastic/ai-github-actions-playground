/**
 * Dashboard history slice — undo/redo ring buffer.
 *
 * Manages the undo and redo stacks for dashboard mutations. History is
 * session-only (not persisted) and capped at `MAX_HISTORY_DEPTH` entries.
 */

import type { StateCreator } from "zustand";

import {
  MAX_HISTORY_DEPTH,
  type DashboardStoreSharedState,
  type HistoryEntry,
  replaceActiveDashboard,
} from "./dashboardStoreUtils";

export interface DashboardHistorySlice {
  historyPast: HistoryEntry[];
  historyFuture: HistoryEntry[];

  undoDashboardChange: () => void;
  redoDashboardChange: () => void;
}

export const createDashboardHistorySlice: StateCreator<
  DashboardHistorySlice & DashboardStoreSharedState,
  [],
  [],
  DashboardHistorySlice
> = (set) => ({
  historyPast: [],
  historyFuture: [],

  undoDashboardChange: () =>
    set((s) => {
      const entry = s.historyPast[s.historyPast.length - 1];
      if (!entry) return {};
      return {
        ...replaceActiveDashboard(s, entry.dashboard),
        historyPast: s.historyPast.slice(0, -1),
        historyFuture: [{ dashboard: s.dashboard, label: entry.label }, ...s.historyFuture],
      };
    }),

  redoDashboardChange: () =>
    set((s) => {
      const entry = s.historyFuture[0];
      if (!entry) return {};
      return {
        ...replaceActiveDashboard(s, entry.dashboard),
        historyPast: [...s.historyPast, { dashboard: s.dashboard, label: entry.label }].slice(
          -MAX_HISTORY_DEPTH,
        ),
        historyFuture: s.historyFuture.slice(1),
      };
    }),
});
