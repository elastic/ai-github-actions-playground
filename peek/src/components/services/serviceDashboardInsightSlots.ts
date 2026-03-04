import type { InsightSlotDefinition } from "../../types/insightSlots";

import type { DeploymentRow, RecentTrace, RouteRow } from "./serviceDashboardHelpers";
import { normalizeStatusLabel } from "./serviceDashboardPageUtils";

export const SERVICE_DASHBOARD_INSIGHT_SLOT_IDS = {
  searchControls: "service-dashboard-search-controls",
  summaryCards: "service-dashboard-summary-cards",
  deploymentsPanel: "service-dashboard-deployments-panel",
  topRoutesPanel: "service-dashboard-top-routes-panel",
  traceStatusPanel: "service-dashboard-trace-status-panel",
  slowOperationsPanel: "service-dashboard-slow-operations-panel",
  dependencyHotspotsPanel: "service-dashboard-dependency-hotspots-panel",
  traceExplorerPanel: "service-dashboard-trace-explorer-panel",
  k8sPanel: "service-dashboard-k8s-panel",
} as const;

const ROUTE_ROW_SLOT_PREFIX = "service-dashboard-route-row";
const DEPLOYMENT_ROW_SLOT_PREFIX = "service-dashboard-deployment-row";

export function routeRowInsightSlotId(route: string): string {
  return `${ROUTE_ROW_SLOT_PREFIX}:${encodeURIComponent(route)}`;
}

export function deploymentRowInsightSlotId(version: string): string {
  return `${DEPLOYMENT_ROW_SLOT_PREFIX}:${encodeURIComponent(version)}`;
}

export function buildRouteRowInsightSlots(
  rows: RouteRow[],
  limit: number,
): InsightSlotDefinition[] {
  return rows.slice(0, limit).map((row) => ({
    slotId: routeRowInsightSlotId(row.route),
    label:
      `Top route row for ${row.route}. ` +
      `Requests=${row.requestCount}, avgLatencyMs=${row.avgLatencyMs.toFixed(1)}, ` +
      `errorRate=${(row.errorRate * 100).toFixed(1)}%, errorCount=${row.errorCount}.`,
  }));
}

export function buildDeploymentRowInsightSlots(
  rows: DeploymentRow[],
  limit: number,
): InsightSlotDefinition[] {
  return rows.slice(0, limit).map((row) => ({
    slotId: deploymentRowInsightSlotId(row.version),
    label:
      `Deployment version row for ${row.version}. ` +
      `Requests=${row.requestCount}, errorRate=${(row.errorRate * 100).toFixed(1)}%, firstSeen=${row.firstSeen}, lastSeen=${row.lastSeen}.`,
  }));
}

export const SERVICE_DASHBOARD_INSIGHT_SLOTS: InsightSlotDefinition[] = [
  {
    slotId: SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.searchControls,
    label: "Service dashboard controls: time range, search trigger, and reset actions",
  },
  {
    slotId: SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.summaryCards,
    label:
      "Service dashboard summary KPI cards for request volume, latency, errors, and route count",
  },
  {
    slotId: SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.deploymentsPanel,
    label: "Deployments panel: service version history and request distribution by version",
  },
  {
    slotId: SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.topRoutesPanel,
    label: "Top Routes panel: route-level request volume, latency, and error trends",
  },
  {
    slotId: SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.traceStatusPanel,
    label: "Trace status breakdown panel for the selected service and window",
  },
  {
    slotId: SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.slowOperationsPanel,
    label: "Slow operations panel showing operations with highest max and average duration",
  },
  {
    slotId: SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.dependencyHotspotsPanel,
    label:
      "Dependency hotspots panel with a service graph and ranked inbound/outbound dependency risk table",
  },
  {
    slotId: SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.traceExplorerPanel,
    label: "Trace Explorer panel: recent trace/span behavior for this service",
  },
  {
    slotId: SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.k8sPanel,
    label: "Kubernetes context panel for namespace, node, and pod distribution",
  },
];

export function summarizeTraceSignals(traces: RecentTrace[]): {
  errorTraceCount: number;
  maxDurationMs: number;
} {
  return traces.reduce(
    (acc, trace) => {
      if (normalizeStatusLabel(trace.statusCode).toLowerCase() === "error") {
        acc.errorTraceCount += 1;
      }
      if (trace.durationMs > acc.maxDurationMs) {
        acc.maxDurationMs = trace.durationMs;
      }
      return acc;
    },
    { errorTraceCount: 0, maxDurationMs: 0 },
  );
}
