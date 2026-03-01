import type { z } from "zod";

import type { persesDashboardSchema, persesWorkspaceSnapshotSchema } from "../../schemas";
import type { DashboardDefinition, DashboardParameter, PanelDefinition } from "../../types";

export type PersesDashboardDefinition = z.infer<typeof persesDashboardSchema>;
export type PersesWorkspaceSnapshot = z.infer<typeof persesWorkspaceSnapshotSchema>;

function toPersesVariableKind(
  source: DashboardParameter["source"],
): "TextVariable" | "ListVariable" | "QueryVariable" {
  switch (source.mode) {
    case "options":
      return "ListVariable";
    case "esql":
      return "QueryVariable";
    case "text":
    default:
      return "TextVariable";
  }
}

export function toPersesDashboard(dashboard: DashboardDefinition): PersesDashboardDefinition {
  const variables = (dashboard.parameters ?? []).map((parameter) => ({
    kind: toPersesVariableKind(parameter.source),
    spec: {
      name: parameter.name,
      display: { name: parameter.label },
      type: parameter.type,
      source: parameter.source,
      value: parameter.value,
    },
  }));

  return {
    kind: "Dashboard",
    metadata: {
      name: dashboard.id,
      labels: dashboard.tags,
      annotations: {
        description: dashboard.description,
        archived: dashboard.archived,
        favoritedAt: dashboard.favoritedAt,
        preferredProfileId: dashboard.preferredProfileId,
        createdAt: dashboard.createdAt,
        updatedAt: dashboard.updatedAt,
      },
    },
    spec: {
      display: { name: dashboard.title },
      panels: Object.fromEntries(
        dashboard.panels.map((panel) => [
          panel.id,
          {
            kind: "Panel",
            spec: {
              display: { name: panel.title },
              query: panel.query,
              visualization: panel.visualization,
              layout: panel.layout,
              options: panel.options as Record<string, unknown> | undefined,
              refreshInterval: panel.refreshInterval,
            },
          },
        ]),
      ),
      variables,
      timeRange: dashboard.timeRange,
      timeZone: dashboard.timeZone,
      refreshInterval: dashboard.refreshInterval,
    },
  };
}

export function fromPersesDashboard(dashboard: PersesDashboardDefinition): DashboardDefinition {
  const annotations = dashboard.metadata.annotations;
  return {
    id: dashboard.metadata.name,
    title: dashboard.spec.display.name,
    description: annotations?.description,
    tags: dashboard.metadata.labels,
    archived: annotations?.archived,
    favoritedAt: annotations?.favoritedAt,
    preferredProfileId: annotations?.preferredProfileId,
    panels: Object.entries(dashboard.spec.panels).map(([id, panel]) => ({
      id,
      title: panel.spec.display.name,
      query: panel.spec.query,
      visualization: panel.spec.visualization,
      layout: panel.spec.layout,
      options: panel.spec.options as PanelDefinition["options"],
      refreshInterval: panel.spec.refreshInterval,
    })),
    parameters: dashboard.spec.variables?.map((variable) => ({
      name: variable.spec.name,
      label: variable.spec.display.name,
      type: variable.spec.type,
      source: variable.spec.source,
      value: variable.spec.value,
    })),
    timeRange: dashboard.spec.timeRange,
    timeZone: dashboard.spec.timeZone,
    refreshInterval: dashboard.spec.refreshInterval,
    createdAt: annotations?.createdAt ?? new Date().toISOString(),
    updatedAt: annotations?.updatedAt ?? new Date().toISOString(),
  };
}

export function toPersesWorkspaceSnapshot(
  dashboards: DashboardDefinition[],
  activeDashboardId: string,
): PersesWorkspaceSnapshot {
  return {
    kind: "Workspace",
    spec: {
      dashboards: dashboards.map((dashboard) => toPersesDashboard(dashboard)),
      activeDashboardId,
    },
  };
}

export function fromPersesWorkspaceSnapshot(workspace: PersesWorkspaceSnapshot): {
  dashboards: DashboardDefinition[];
  activeDashboardId: string;
} {
  return {
    dashboards: workspace.spec.dashboards.map((dashboard) => fromPersesDashboard(dashboard)),
    activeDashboardId: workspace.spec.activeDashboardId,
  };
}
