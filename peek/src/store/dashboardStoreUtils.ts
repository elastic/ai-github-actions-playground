/**
 * Shared helper functions used by multiple dashboard store slices.
 *
 * These are pure functions — no store state is captured. Each slice
 * passes the relevant subset of state as arguments.
 */

import type { DashboardDefinition } from "../types";
import { createDefaultDashboard } from "../dashboards/default";

import { getNextDuplicatedTitle } from "./dashboardTitleUtils";

/** Maximum number of undo history entries to retain. */
export const MAX_HISTORY_DEPTH = 50;

/** A single entry in the undo/redo history ring buffer. */
export interface HistoryEntry {
  dashboard: DashboardDefinition;
  label: string;
}

export function getNextDuplicatedPanelTitle(sourceTitle: string, existingTitles: string[]): string {
  return getNextDuplicatedTitle(sourceTitle, existingTitles, "Panel");
}

export function getNextDuplicatedDashboardTitle(
  sourceTitle: string,
  existingTitles: string[],
): string {
  return getNextDuplicatedTitle(sourceTitle, existingTitles, "Dashboard");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function getActiveDashboard(
  state: Pick<DashboardStoreSharedState, "dashboard" | "dashboards" | "activeDashboardId">,
): DashboardDefinition {
  return state.dashboards.find((d) => d.id === state.activeDashboardId) ?? state.dashboard;
}

export function syncActiveState(
  dashboards: DashboardDefinition[],
  activeDashboardId: string,
): Pick<DashboardStoreSharedState, "dashboard" | "dashboards" | "activeDashboardId"> {
  const fallback = createDefaultDashboard();
  const active = dashboards.find((d) => d.id === activeDashboardId) ?? dashboards[0] ?? fallback;
  const nextDashboards = dashboards.length > 0 ? dashboards : [active];
  return {
    dashboard: active,
    dashboards: nextDashboards,
    activeDashboardId: active.id,
  };
}

export function replaceActiveDashboard(
  state: Pick<DashboardStoreSharedState, "dashboard" | "dashboards" | "activeDashboardId">,
  nextActive: DashboardDefinition,
): Pick<DashboardStoreSharedState, "dashboard" | "dashboards" | "activeDashboardId"> {
  const idx = state.dashboards.findIndex((d) => d.id === state.activeDashboardId);
  const dashboards = [...state.dashboards];
  if (idx >= 0) {
    dashboards[idx] = nextActive;
  } else {
    dashboards.push(nextActive);
  }
  return syncActiveState(dashboards, nextActive.id);
}

/** Push the current dashboard onto the past stack, returning the updated history slices. */
export function pushToHistory(
  s: Pick<DashboardStoreSharedState, "dashboard" | "historyPast">,
  label: string,
): Pick<DashboardStoreSharedState, "historyPast" | "historyFuture"> {
  return {
    historyPast: [
      ...s.historyPast.slice(-(MAX_HISTORY_DEPTH - 1)),
      { dashboard: s.dashboard, label },
    ],
    historyFuture: [],
  };
}

/**
 * Minimal shared state shape referenced across slices.
 *
 * Each slice narrows to the fields it actually reads/writes; this type keeps
 * the helpers correctly typed without pulling in the full `DashboardState`.
 */
export interface DashboardStoreSharedState {
  dashboard: DashboardDefinition;
  dashboards: DashboardDefinition[];
  activeDashboardId: string;
  historyPast: HistoryEntry[];
  historyFuture: HistoryEntry[];
}
