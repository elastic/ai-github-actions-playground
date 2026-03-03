/**
 * Pure utility functions for dashboard and workspace import/export.
 *
 * These are stateless — callers pass in the data to export or import.
 * No Zustand store is referenced here, keeping the logic easy to test
 * and reuse.
 */

import type { DashboardDefinition } from "../types";
import {
  dashboardDefinitionSchema,
  persesDashboardSchema,
  persesWorkspaceSnapshotSchema,
  workspaceSnapshotSchema,
} from "../schemas";
import {
  fromPersesDashboard,
  fromPersesWorkspaceSnapshot,
  toPersesDashboard,
  toPersesWorkspaceSnapshot,
} from "../services/perses/dashboardAdapters";

function formatValidationError(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): string {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

export function exportDashboard(dashboard: DashboardDefinition): string {
  return JSON.stringify(toPersesDashboard(dashboard), null, 2);
}

export function exportWorkspace(
  dashboards: DashboardDefinition[],
  activeDashboardId: string,
): string {
  return JSON.stringify(toPersesWorkspaceSnapshot(dashboards, activeDashboardId), null, 2);
}

export function importDashboard(json: string): {
  success: boolean;
  error?: string;
  dashboard?: DashboardDefinition;
} {
  try {
    const payload = JSON.parse(json);
    const isPersesPayload =
      !!payload &&
      typeof payload === "object" &&
      (payload as { kind?: unknown }).kind === "Dashboard";
    let importedDashboard: DashboardDefinition;
    if (isPersesPayload) {
      const result = persesDashboardSchema.safeParse(payload);
      if (!result.success) {
        const error = formatValidationError(result.error);
        console.error("Import failed:", error);
        return { success: false, error };
      }
      importedDashboard = fromPersesDashboard(result.data);
    } else {
      const result = dashboardDefinitionSchema.safeParse(payload);
      if (!result.success) {
        const error = formatValidationError(result.error);
        console.error("Import failed:", error);
        return { success: false, error };
      }
      importedDashboard = result.data;
    }
    return { success: true, dashboard: importedDashboard };
  } catch (errorLike: unknown) {
    const error = errorLike instanceof Error ? errorLike.message : String(errorLike);
    console.error("Import failed: invalid JSON", error);
    return { success: false, error };
  }
}

export function importWorkspace(json: string): {
  success: boolean;
  error?: string;
  dashboards?: DashboardDefinition[];
  activeDashboardId?: string;
} {
  try {
    const payload = JSON.parse(json);
    const isPersesPayload =
      !!payload &&
      typeof payload === "object" &&
      (payload as { kind?: unknown }).kind === "Workspace";
    let dashboards: DashboardDefinition[];
    let activeDashboardId: string;
    if (isPersesPayload) {
      const result = persesWorkspaceSnapshotSchema.safeParse(payload);
      if (!result.success) {
        const error = formatValidationError(result.error);
        console.error("Workspace import failed:", error);
        return { success: false, error };
      }
      const parsed = fromPersesWorkspaceSnapshot(result.data);
      dashboards = parsed.dashboards;
      activeDashboardId = parsed.activeDashboardId;
    } else {
      const result = workspaceSnapshotSchema.safeParse(payload);
      if (!result.success) {
        const error = formatValidationError(result.error);
        console.error("Workspace import failed:", error);
        return { success: false, error };
      }
      dashboards = result.data.dashboards;
      activeDashboardId = result.data.activeDashboardId;
    }
    if (new Set(dashboards.map((dashboard) => dashboard.id)).size !== dashboards.length) {
      const error = "dashboard IDs must be unique within a workspace import";
      console.error("Workspace import failed:", error);
      return { success: false, error };
    }
    if (!dashboards.some((dashboard) => dashboard.id === activeDashboardId)) {
      const error = "activeDashboardId does not match any dashboard in the workspace";
      console.error("Workspace import failed:", error);
      return { success: false, error };
    }
    return { success: true, dashboards, activeDashboardId };
  } catch (errorLike: unknown) {
    const error = errorLike instanceof Error ? errorLike.message : String(errorLike);
    console.error("Workspace import failed: invalid JSON", error);
    return { success: false, error };
  }
}

export function hydrateWorkspaceFromPersistedState(
  persistedState: unknown,
): { dashboards: DashboardDefinition[]; activeDashboardId: string } | null {
  if (!persistedState || typeof persistedState !== "object") {
    return null;
  }
  const record = persistedState as Record<string, unknown>;
  if ("workspace" in record) {
    const parsedWorkspace = persesWorkspaceSnapshotSchema.safeParse(record.workspace);
    if (parsedWorkspace.success) {
      return fromPersesWorkspaceSnapshot(parsedWorkspace.data);
    }
  }

  const parsedPersesWorkspace = persesWorkspaceSnapshotSchema.safeParse(record);
  if (parsedPersesWorkspace.success) {
    return fromPersesWorkspaceSnapshot(parsedPersesWorkspace.data);
  }

  const parsedLegacyWorkspace = workspaceSnapshotSchema.safeParse(record);
  if (parsedLegacyWorkspace.success) {
    return parsedLegacyWorkspace.data;
  }

  const parsedLegacyDashboard = dashboardDefinitionSchema.safeParse(record.dashboard);
  if (parsedLegacyDashboard.success) {
    return {
      dashboards: [parsedLegacyDashboard.data],
      activeDashboardId: parsedLegacyDashboard.data.id,
    };
  }

  return null;
}
