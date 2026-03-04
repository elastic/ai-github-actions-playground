import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { useShallow } from "zustand/react/shallow";

import { INSIGHT_GUARDRAIL, INSIGHT_SPECIFICITY_POLICY } from "../../hooks/insightPromptUtils";
import { usePageSlotInsights } from "../../hooks/usePageSlotInsights";
import { PAGE_MANIFEST } from "../../routes/manifest";
import { useConnectionStore } from "../../store/useConnectionStore";
import { usePageFiltersStore } from "../../store/usePageFiltersStore";
import { useTracesStore } from "../../store/useTracesStore";
import EmptyState from "../EmptyState";
import InsightSlot from "../InsightSlot";
import { InsightSlotProvider } from "../InsightSlotContext";
import PageHeader from "../PageHeader";
import { EMPTY_FILTERS } from "../traces/traceQueryBuilder";
import { buildServiceMapData } from "../traces/traceUtils";

import ServiceDashboardControls from "./ServiceDashboardControls";
import {
  type RouteSortField,
  type TraceSortField,
  type SortDirection,
  parseRouteRows,
  parseRecentTraces,
  parseDeploymentRows,
  parseServiceK8sContext,
} from "./serviceDashboardHelpers";
import ServiceDashboardSummaryCards from "./ServiceDashboardSummaryCards";
import ServiceDependencyHotspotsPanel from "./ServiceDependencyHotspotsPanel";
import ServiceDeploymentsPanel from "./ServiceDeploymentsPanel";
import ServiceK8sInfoPanel from "./ServiceK8sInfoPanel";
import ServiceRoutesPanel from "./ServiceRoutesPanel";
import { ServiceSlowOperationsPanel, ServiceTraceStatusPanel } from "./ServiceTraceBreakdownPanels";
import ServiceTracesPanel from "./ServiceTracesPanel";
import {
  buildDashboardSummary,
  compareByField,
  decodeServiceName,
} from "./serviceDashboardPageUtils";
import {
  SERVICE_DASHBOARD_INSIGHT_SLOTS,
  SERVICE_DASHBOARD_INSIGHT_SLOT_IDS,
  buildDeploymentRowInsightSlots,
  buildRouteRowInsightSlots,
  deploymentRowInsightSlotId,
  routeRowInsightSlotId,
  summarizeTraceSignals,
} from "./serviceDashboardInsightSlots";
import { useServiceDashboardQueries } from "./useServiceDashboardQueries";

export default function ServiceDashboardPage() {
  const navigate = useNavigate();
  const { serviceName: rawServiceName = "" } = useParams<{ serviceName: string }>();
  const serviceName = decodeServiceName(rawServiceName);
  const connection = useConnectionStore((s) => s.connection);
  const { serviceFilters, updateServiceFilters } = usePageFiltersStore(
    useShallow((s) => ({
      serviceFilters: s.serviceFilters,
      updateServiceFilters: s.updateServiceFilters,
    })),
  );

  const [timeFrom, setTimeFrom] = useState(serviceFilters.timeFrom);
  const [timeTo, setTimeTo] = useState(serviceFilters.timeTo);
  const {
    clearLatestQueries,
    deploymentsResult,
    error,
    handleReset,
    k8sContextResult,
    loading,
    routeSparklineData,
    traceExplorerLoading,
    traceExplorerSpans,
    routesResult,
    tracesResult,
  } = useServiceDashboardQueries({
    connection,
    serviceName,
    timeFrom,
    timeTo,
  });
  const [routeSortField, setRouteSortField] = useState<RouteSortField>("requestCount");
  const [routeSortDirection, setRouteSortDirection] = useState<SortDirection>("desc");
  const [traceSortField, setTraceSortField] = useState<TraceSortField>("timestamp");
  const [traceSortDirection, setTraceSortDirection] = useState<SortDirection>("desc");

  const handleRouteSort = useCallback(
    (field: RouteSortField) => {
      if (field === routeSortField) {
        setRouteSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setRouteSortField(field);
        setRouteSortDirection("desc");
      }
    },
    [routeSortField],
  );

  const handleTraceSort = useCallback(
    (field: TraceSortField) => {
      if (field === traceSortField) {
        setTraceSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setTraceSortField(field);
        setTraceSortDirection("desc");
      }
    },
    [traceSortField],
  );

  const handleViewTrace = useCallback(
    (traceId: string) => {
      useTracesStore.getState().setFilters({
        ...EMPTY_FILTERS,
        timeFrom,
        timeTo,
        services: [serviceName],
      });
      useTracesStore.getState().setSelectedTraceId(traceId);
      navigate(PAGE_MANIFEST.traces.path);
    },
    [navigate, serviceName, timeFrom, timeTo],
  );

  const handleViewAllTraces = useCallback(() => {
    useTracesStore.getState().setFilters({
      ...EMPTY_FILTERS,
      timeFrom,
      timeTo,
      services: [serviceName],
    });
    useTracesStore.getState().setSelectedTraceId(null);
    navigate(PAGE_MANIFEST.traces.path);
  }, [navigate, serviceName, timeFrom, timeTo]);
  const handleDependencyNodeClick = useCallback(
    (peerServiceName: string) => {
      useTracesStore.getState().setFilters({
        ...EMPTY_FILTERS,
        timeFrom,
        timeTo,
        services: [serviceName, peerServiceName],
      });
      useTracesStore.getState().setSelectedTraceId(null);
      navigate(PAGE_MANIFEST.traces.path);
    },
    [navigate, serviceName, timeFrom, timeTo],
  );

  const routeRows = useMemo(() => {
    if (!routesResult) return [];
    const rows = parseRouteRows(routesResult);
    return rows.sort((a, b) => compareByField(a, b, routeSortField, routeSortDirection));
  }, [routesResult, routeSortField, routeSortDirection]);
  const topRouteRows = useMemo(() => routeRows.slice(0, 50), [routeRows]);

  const recentTraces = useMemo(() => {
    if (!tracesResult) return [];
    const traces = parseRecentTraces(tracesResult);
    return traces.sort((a, b) => compareByField(a, b, traceSortField, traceSortDirection));
  }, [tracesResult, traceSortField, traceSortDirection]);
  const summary = useMemo(() => buildDashboardSummary(routeRows), [routeRows]);
  const deployments = useMemo(() => {
    if (!deploymentsResult) return [];
    return parseDeploymentRows(deploymentsResult);
  }, [deploymentsResult]);
  const k8sRows = useMemo(() => {
    if (!k8sContextResult) return [];
    return parseServiceK8sContext(k8sContextResult);
  }, [k8sContextResult]);
  const hasLoadedResults = Boolean(
    routesResult || tracesResult || deploymentsResult || k8sContextResult,
  );
  const topRouteSignals = useMemo(() => topRouteRows.slice(0, 20), [topRouteRows]);
  const topTraceSignals = useMemo(() => recentTraces.slice(0, 20), [recentTraces]);
  const traceSignals = useMemo(() => summarizeTraceSignals(recentTraces), [recentTraces]);
  const statusBreakdownSignals = useMemo(() => {
    const total = recentTraces.length;
    const counts = new Map<string, number>();
    for (const trace of recentTraces) {
      const status =
        !trace.statusCode || trace.statusCode === "STATUS_CODE_OK" ? "OK" : trace.statusCode;
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([status, count]) => ({
        status,
        count,
        percent: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [recentTraces]);
  const slowOperationSignals = useMemo(() => {
    const byOperation = new Map<
      string,
      { count: number; maxDurationMs: number; avgDurationMs: number }
    >();
    for (const trace of recentTraces) {
      const key = trace.spanName || "unknown";
      const existing = byOperation.get(key);
      if (!existing) {
        byOperation.set(key, {
          count: 1,
          maxDurationMs: trace.durationMs,
          avgDurationMs: trace.durationMs,
        });
      } else {
        const nextCount = existing.count + 1;
        byOperation.set(key, {
          count: nextCount,
          maxDurationMs: Math.max(existing.maxDurationMs, trace.durationMs),
          avgDurationMs: (existing.avgDurationMs * existing.count + trace.durationMs) / nextCount,
        });
      }
    }
    return Array.from(byOperation.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.maxDurationMs - a.maxDurationMs)
      .slice(0, 10);
  }, [recentTraces]);
  const dependencySignals = useMemo(() => {
    if (traceExplorerSpans.length === 0) return [];
    const graph = buildServiceMapData(traceExplorerSpans);
    return graph.edges
      .filter((edge) => edge.source === serviceName || edge.target === serviceName)
      .map((edge) => ({
        direction: edge.source === serviceName ? "outbound" : "inbound",
        peerService: edge.source === serviceName ? edge.target : edge.source,
        calls: edge.callCount,
        errorRate: edge.callCount > 0 ? edge.errorCount / edge.callCount : 0,
        avgLatencyMs: edge.callCount > 0 ? edge.totalDurationUs / edge.callCount / 1000 : 0,
      }))
      .sort((a, b) => b.errorRate - a.errorRate || b.avgLatencyMs - a.avgLatencyMs)
      .slice(0, 10);
  }, [serviceName, traceExplorerSpans]);
  const routeRowInsightSlots = useMemo(
    () => buildRouteRowInsightSlots(topRouteRows, 20),
    [topRouteRows],
  );
  const deploymentRowInsightSlots = useMemo(
    () => buildDeploymentRowInsightSlots(deployments, 10),
    [deployments],
  );
  const routeInsightSlotIds = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of topRouteRows.slice(0, 20)) {
      map[row.route] = routeRowInsightSlotId(row.route);
    }
    return map;
  }, [topRouteRows]);
  const deploymentInsightSlotIds = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of deployments.slice(0, 10)) {
      map[row.version] = deploymentRowInsightSlotId(row.version);
    }
    return map;
  }, [deployments]);
  const dashboardInsightContext = useMemo(
    () =>
      JSON.stringify({
        page: {
          id: "service-details",
          serviceName,
          purpose:
            "Help engineers understand one service's health through routes, deployments, traces, and kubernetes context.",
        },
        filters: { timeFrom, timeTo },
        totals: {
          routeCount: routeRows.length,
          traceCount: recentTraces.length,
          deploymentCount: deployments.length,
          k8sRowCount: k8sRows.length,
        },
        summary,
        traceSignals,
        statusBreakdown: statusBreakdownSignals,
        slowOperations: slowOperationSignals,
        dependencyHotspots: dependencySignals,
        topRoutes: topRouteSignals.map((row) => ({
          route: row.route,
          requestCount: row.requestCount,
          avgLatencyMs: row.avgLatencyMs,
          errorRate: row.errorRate,
          errorCount: row.errorCount,
        })),
        deployments: deployments.slice(0, 10).map((row) => ({
          version: row.version,
          requestCount: row.requestCount,
          errorCount: row.errorCount,
          errorRate: row.errorRate,
          firstSeen: row.firstSeen,
          lastSeen: row.lastSeen,
        })),
        recentTraces: topTraceSignals.map((trace) => ({
          traceId: trace.traceId,
          spanName: trace.spanName,
          durationMs: trace.durationMs,
          statusCode: trace.statusCode,
          timestamp: trace.timestamp,
        })),
        k8sRows: k8sRows.slice(0, 20),
      }),
    [
      serviceName,
      timeFrom,
      timeTo,
      routeRows.length,
      recentTraces.length,
      k8sRows,
      summary,
      traceSignals,
      topRouteSignals,
      topTraceSignals,
      statusBreakdownSignals,
      slowOperationSignals,
      dependencySignals,
      deployments,
    ],
  );
  const dashboardInsightSlots = useMemo(
    () => [
      ...SERVICE_DASHBOARD_INSIGHT_SLOTS,
      ...routeRowInsightSlots,
      ...deploymentRowInsightSlots,
    ],
    [routeRowInsightSlots, deploymentRowInsightSlots],
  );
  const dashboardSlotInsights = usePageSlotInsights({
    context: dashboardInsightContext,
    systemPrompt:
      "You are an APM service-details copilot. " +
      "Generate one concise, high-signal insight per UI slot. " +
      "Prioritize actionable findings for regressions, hotspots, and likely next investigations. " +
      "Ground every claim in the provided context and include concrete values when available. " +
      "Do not generate KPI recap statements unless they imply a specific risk or decision. " +
      "If the slot appears healthy/steady, state that briefly and propose one concrete next check. " +
      INSIGHT_SPECIFICITY_POLICY +
      "Keep each slot insight under 2 sentences." +
      INSIGHT_GUARDRAIL,
    cacheKey: `service-details-slots::${dashboardInsightContext}`,
    slots: dashboardInsightSlots,
    enabled: hasLoadedResults,
  });

  return (
    <InsightSlotProvider
      summary={dashboardSlotInsights.summary}
      insights={dashboardSlotInsights.insights}
      loading={dashboardSlotInsights.loading}
      error={dashboardSlotInsights.error}
      refresh={dashboardSlotInsights.refresh}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minHeight: "100%" }}>
        <PageHeader
          title={serviceName}
          description="Routes, traces, and deployments for this service."
          actions={
            <Button
              size="small"
              variant="text"
              onClick={() => navigate(PAGE_MANIFEST.services.path)}
            >
              ← Services
            </Button>
          }
        />

        <InsightSlot slotId={SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.searchControls}>
          <ServiceDashboardControls
            loading={loading}
            timeFrom={timeFrom}
            timeTo={timeTo}
            onReset={handleReset}
            onTimeRangeChange={(from, to) => {
              clearLatestQueries();
              setTimeFrom(from);
              setTimeTo(to);
              updateServiceFilters({ timeFrom: from, timeTo: to });
            }}
          />
        </InsightSlot>

        {error && <Alert severity="error">{error}</Alert>}

        {!loading && !routesResult && !tracesResult && !deploymentsResult && !k8sContextResult && (
          <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
            <EmptyState
              heading="No service data loaded"
              description={`No trace data was loaded for ${serviceName} in the selected time range.`}
              verticalAlign="center"
              addDataHref={PAGE_MANIFEST.addData.path}
            />
          </Paper>
        )}

        {summary && (
          <InsightSlot slotId={SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.summaryCards}>
            <ServiceDashboardSummaryCards summary={summary} />
          </InsightSlot>
        )}

        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.5}
          sx={{ alignItems: "flex-start" }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack spacing={1.5}>
              {topRouteRows.length > 0 && (
                <InsightSlot slotId={SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.topRoutesPanel}>
                  <ServiceRoutesPanel
                    routeRows={topRouteRows}
                    sortField={routeSortField}
                    sortDirection={routeSortDirection}
                    onSort={handleRouteSort}
                    sparklineData={routeSparklineData}
                    routeInsightSlotIds={routeInsightSlotIds}
                  />
                </InsightSlot>
              )}

              {deployments.length > 0 && (
                <InsightSlot slotId={SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.deploymentsPanel}>
                  <ServiceDeploymentsPanel
                    deployments={deployments}
                    deploymentInsightSlotIds={deploymentInsightSlotIds}
                  />
                </InsightSlot>
              )}

              {recentTraces.length > 0 && (
                <InsightSlot slotId={SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.traceStatusPanel}>
                  <ServiceTraceStatusPanel traces={recentTraces} />
                </InsightSlot>
              )}
            </Stack>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack spacing={1.5}>
              {traceExplorerSpans.length > 0 && (
                <InsightSlot slotId={SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.dependencyHotspotsPanel}>
                  <ServiceDependencyHotspotsPanel
                    serviceName={serviceName}
                    spans={traceExplorerSpans}
                    onPeerServiceClick={handleDependencyNodeClick}
                  />
                </InsightSlot>
              )}

              {recentTraces.length > 0 && (
                <InsightSlot slotId={SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.slowOperationsPanel}>
                  <ServiceSlowOperationsPanel traces={recentTraces} />
                </InsightSlot>
              )}

              {k8sRows.length > 0 && (
                <InsightSlot slotId={SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.k8sPanel}>
                  <ServiceK8sInfoPanel rows={k8sRows} />
                </InsightSlot>
              )}
            </Stack>
          </Box>
        </Stack>

        {recentTraces.length > 0 && (
          <Box sx={{ width: "100%", minWidth: 0 }}>
            <InsightSlot slotId={SERVICE_DASHBOARD_INSIGHT_SLOT_IDS.traceExplorerPanel}>
              <ServiceTracesPanel
                traces={recentTraces}
                traceExplorerSpans={traceExplorerSpans}
                traceExplorerLoading={traceExplorerLoading}
                sortField={traceSortField}
                sortDirection={traceSortDirection}
                onSort={handleTraceSort}
                onViewTrace={handleViewTrace}
                onViewAllTraces={handleViewAllTraces}
              />
            </InsightSlot>
          </Box>
        )}

        {!loading &&
          routesResult &&
          deployments.length === 0 &&
          routeRows.length === 0 &&
          recentTraces.length === 0 &&
          k8sRows.length === 0 && (
            <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
              <EmptyState
                heading="No data found"
                description={`No routes or traces found for ${serviceName} in the selected time range.`}
                verticalAlign="center"
                addDataHref={PAGE_MANIFEST.addData.path}
              />
            </Paper>
          )}
      </Box>
    </InsightSlotProvider>
  );
}
