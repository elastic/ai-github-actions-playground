import type { z } from "zod";

import type { persesDashboardSchema, persesWorkspaceSnapshotSchema } from "../../schemas";
import type { DashboardDefinition, DashboardParameter, PanelDefinition } from "../../types";

import {
  getPersesPanelPluginKind,
  getVisualizationTypeForPersesPanelKind,
} from "./panelPluginKinds";

export type PersesDashboardDefinition = z.infer<typeof persesDashboardSchema>;
export type PersesWorkspaceSnapshot = z.infer<typeof persesWorkspaceSnapshotSchema>;

function toSerializableY(y: number): number {
  return Number.isFinite(y) ? y : Number.MAX_SAFE_INTEGER;
}

function toPanelQueries(panel: Pick<PanelDefinition, "query" | "queries">): string[] {
  const canonicalQueries =
    panel.queries?.map((query) => query.trim()).filter((query) => query.length > 0) ?? [];
  const primaryQuery = panel.query.trim();
  if (canonicalQueries.length === 0) {
    return primaryQuery.length > 0 ? [primaryQuery] : [];
  }
  return primaryQuery.length > 0 ? [primaryQuery, ...canonicalQueries.slice(1)] : canonicalQueries;
}

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
              layout: { ...panel.layout, y: toSerializableY(panel.layout.y) },
              plugin: {
                kind: getPersesPanelPluginKind(panel.visualization),
                spec: panel.options as Record<string, unknown> | undefined,
              },
              queries: toPanelQueries(panel).map((query) => ({
                kind: "EsqlQuery",
                spec: { query },
              })),
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
    panels: Object.entries(dashboard.spec.panels).map(([id, panel]) => {
      const canonicalQueries = (panel.spec.queries ?? [])
        .map((entry) => entry.spec?.query ?? entry.query)
        .filter((query): query is string => typeof query === "string" && query.trim().length > 0);
      const queries =
        canonicalQueries.length > 0 ? canonicalQueries : panel.spec.query ? [panel.spec.query] : [];
      const query = queries[0] ?? "";
      const visualization =
        getVisualizationTypeForPersesPanelKind(panel.spec.plugin?.kind) ??
        panel.spec.visualization ??
        "timeseries";
      const options = panel.spec.plugin?.spec ?? panel.spec.options;
      return {
        id,
        title: panel.spec.display.name,
        query,
        queries: queries.length > 0 ? queries : undefined,
        visualization,
        layout: panel.spec.layout,
        options: options as PanelDefinition["options"],
        refreshInterval: panel.spec.refreshInterval,
      };
    }),
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
