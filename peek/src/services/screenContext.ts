import { matchPath } from "react-router-dom";

import { PAGE_MANIFEST } from "../routes/manifest";
import { useApiConsoleStore } from "../store/useApiConsoleStore";
import { useDashboardStore } from "../store/useDashboardStore";
import { usePageContextStore } from "../store/usePageContextStore";
import { useQueryStore } from "../store/useQueryStore";
import { useTracesStore } from "../store/useTracesStore";
import { useExplorerStore } from "../store/useExplorerStore";

const SECURITY_ROUTES = ["/users", "/roles", "/api-keys"];

/* ------------------------------------------------------------------ */
/*  Per-page context section types                                     */
/* ------------------------------------------------------------------ */

export interface PageContextSections {
  clusterOverview?: {
    status: string;
    nodeCount: number;
    indexCount: number;
    storeSize: string;
  };
  clusterHealth?: {
    status: string;
    unassignedShards: number;
    pendingTasks: number;
    activeTab: string;
  };
  indices?: {
    selectedIndex: string | null;
    totalIndices: number;
    healthBreakdown: { green: number; yellow: number; red: number };
  };
  dataStreams?: {
    selectedStream: string | null;
    totalStreams: number;
  };
  ingestPipelines?: {
    selectedPipeline: string | null;
    totalPipelines: number;
    processorCount: number;
  };
  fleet?: {
    totalAgents: number;
    healthyCount: number;
    unhealthyCount: number;
  };
  fleetAgent?: {
    agentId: string;
    hostname: string;
    version: string;
    errorCount: number;
  };
  security?: {
    pageType: "users" | "roles" | "apiKeys";
    selectedItem: string | null;
    totalItems: number;
  };
  console?: {
    requestCount: number;
    lastMethod: string;
    lastPath: string;
  };
}

export interface ScreenContextSnapshot extends PageContextSections {
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
  const pageConfig = Object.values(PAGE_MANIFEST).find((p) => matchPath(p.path, pathname) !== null);
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

  // Console context (read directly from ApiConsoleStore)
  const consoleState = useApiConsoleStore.getState();
  if (consoleState.entries.length > 0 || consoleState.consoleDraft) {
    const lastEntry = consoleState.entries[consoleState.entries.length - 1];
    const draft = consoleState.consoleDraft;
    snapshot.console = {
      requestCount: consoleState.entries.length,
      lastMethod: draft?.method ?? lastEntry?.method ?? "",
      lastPath: draft?.path ?? lastEntry?.path ?? "",
    };
  }

  // Page-published context sections from usePageContextStore
  const pageCtx = usePageContextStore.getState();
  if (pageCtx.clusterOverview) snapshot.clusterOverview = pageCtx.clusterOverview;
  if (pageCtx.clusterHealth) snapshot.clusterHealth = pageCtx.clusterHealth;
  if (pageCtx.indices) snapshot.indices = pageCtx.indices;
  if (pageCtx.dataStreams) snapshot.dataStreams = pageCtx.dataStreams;
  if (pageCtx.ingestPipelines) snapshot.ingestPipelines = pageCtx.ingestPipelines;
  if (pageCtx.fleet) snapshot.fleet = pageCtx.fleet;
  if (pageCtx.fleetAgent) snapshot.fleetAgent = pageCtx.fleetAgent;
  const isSecurityPage = SECURITY_ROUTES.some((p) => matchPath(p, pathname) !== null);
  if (pageCtx.security && isSecurityPage) snapshot.security = pageCtx.security;

  return snapshot;
}
