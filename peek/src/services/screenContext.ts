import { PAGE_MANIFEST } from "../routes/manifest";
import { useDashboardStore } from "../store/useDashboardStore";
import { useQueryStore } from "../store/useQueryStore";
import { useTracesStore } from "../store/useTracesStore";
import { useExplorerStore } from "../store/useExplorerStore";

export interface ScreenContextSnapshot {
  page: { label: string; path: string };
  dashboard?: {
    title: string;
    panelCount: number;
    panels: Array<{ title: string; query?: string; vizType?: string }>;
    timeRange?: { from: string; to: string };
    refreshIntervalSeconds?: number;
  };
  queryLab?: {
    draftQuery: string | null;
    lastQuery: string;
    lastResultSummary?: { rowCount: number; columnCount: number };
  };
  traces?: {
    selectedTraceId: string | null;
    viewMode: string;
    filters: {
      services: string[];
      operations: string[];
      statusCodes: string[];
      minDurationMs: number | null;
      maxDurationMs: number | null;
      tagCount: number;
    };
  };
  metrics?: {
    indexPattern: string;
    selectedMetric: string | null;
    aggregation: string;
    groupBy: string | null;
    filterCount: number;
  };
}

export function buildDetailedScreenContext(
  pathname: string,
  includeData?: boolean,
): ScreenContextSnapshot {
  const pageConfig = Object.values(PAGE_MANIFEST).find((p) => p.path === pathname);
  const pageLabel = pageConfig?.nav.label ?? pathname;

  const snapshot: ScreenContextSnapshot = {
    page: { label: pageLabel, path: pathname },
  };

  // Dashboard context
  const dashState = useDashboardStore.getState();
  const activeDashboard = dashState.dashboards.find((d) => d.id === dashState.activeDashboardId);
  if (activeDashboard) {
    snapshot.dashboard = {
      title: activeDashboard.title,
      panelCount: activeDashboard.panels.length,
      panels: activeDashboard.panels.map((p) => ({
        title: p.title,
        query: includeData ? p.query : undefined,
        vizType: p.visualization,
      })),
      timeRange: dashState.dashboard.timeRange,
      refreshIntervalSeconds: dashState.dashboard.refreshInterval,
    };
  }

  // Query Lab context
  const queryState = useQueryStore.getState();
  if (queryState.discoverQueryDraft || queryState.discoverSessionQuery) {
    snapshot.queryLab = {
      draftQuery: queryState.discoverQueryDraft,
      lastQuery: queryState.discoverSessionQuery,
      ...(includeData && queryState.discoverSessionResult
        ? {
            lastResultSummary: {
              rowCount: queryState.discoverSessionResult.values.length,
              columnCount: queryState.discoverSessionResult.columns.length,
            },
          }
        : {}),
    };
  }

  // Traces context
  const tracesState = useTracesStore.getState();
  if (
    tracesState.selectedTraceId ||
    tracesState.filters.services.length > 0 ||
    tracesState.filters.operations.length > 0 ||
    tracesState.filters.statusCodes.length > 0 ||
    tracesState.filters.minDurationMs !== null ||
    tracesState.filters.maxDurationMs !== null ||
    tracesState.filters.tags.length > 0
  ) {
    snapshot.traces = {
      selectedTraceId: tracesState.selectedTraceId,
      viewMode: tracesState.viewMode,
      filters: {
        services: tracesState.filters.services,
        operations: tracesState.filters.operations,
        statusCodes: tracesState.filters.statusCodes,
        minDurationMs: tracesState.filters.minDurationMs,
        maxDurationMs: tracesState.filters.maxDurationMs,
        tagCount: tracesState.filters.tags.length,
      },
    };
  }

  // Metrics explorer context
  const explorerState = useExplorerStore.getState();
  if (explorerState.selectedMetric) {
    snapshot.metrics = {
      indexPattern: explorerState.indexPattern,
      selectedMetric: explorerState.selectedMetric,
      aggregation: explorerState.aggregation,
      groupBy: explorerState.groupBy,
      filterCount: explorerState.filters.length,
    };
  }

  return snapshot;
}
