import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";

import { PAGE_MANIFEST } from "../../routes/manifest";
import { useConnectionStore } from "../../store/useConnectionStore";
import { useTracesStore } from "../../store/useTracesStore";
import EmptyState from "../EmptyState";
import PageHeader from "../PageHeader";
import { EMPTY_FILTERS } from "../traces/traceQueryBuilder";

import ServiceDashboardControls from "./ServiceDashboardControls";
import {
  type RouteSortField,
  type TraceSortField,
  type SortDirection,
  parseRouteRows,
  parseRecentTraces,
  parseDeploymentRows,
} from "./serviceDashboardHelpers";
import ServiceDashboardSummaryCards from "./ServiceDashboardSummaryCards";
import ServiceDeploymentsPanel from "./ServiceDeploymentsPanel";
import ServiceRoutesPanel from "./ServiceRoutesPanel";
import ServiceTracesPanel from "./ServiceTracesPanel";
import {
  buildDashboardSummary,
  compareByField,
  decodeServiceName,
} from "./serviceDashboardPageUtils";
import { useServiceDashboardQueries } from "./useServiceDashboardQueries";

export default function ServiceDashboardPage() {
  const navigate = useNavigate();
  const { serviceName: rawServiceName = "" } = useParams<{ serviceName: string }>();
  const serviceName = decodeServiceName(rawServiceName);
  const connection = useConnectionStore((s) => s.connection);

  const [timeFrom, setTimeFrom] = useState("NOW() - 1 hour");
  const [timeTo, setTimeTo] = useState("NOW()");
  const {
    clearLatestQueries,
    deploymentsResult,
    error,
    handleReset,
    handleSearch,
    loading,
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title={serviceName}
          description="Service-specific performance dashboard with top routes and recent traces."
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
      </Paper>

      <ServiceDashboardControls
        loading={loading}
        timeFrom={timeFrom}
        timeTo={timeTo}
        onSearch={handleSearch}
        onReset={handleReset}
        onTimeRangeChange={(from, to) => {
          clearLatestQueries();
          setTimeFrom(from);
          setTimeTo(to);
        }}
      />

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !routesResult && !tracesResult && !deploymentsResult && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            heading="No service data loaded"
            description={`Click Search to load performance data for ${serviceName}.`}
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}

      {summary && <ServiceDashboardSummaryCards summary={summary} />}

      {deployments.length > 0 && <ServiceDeploymentsPanel deployments={deployments} />}

      {topRouteRows.length > 0 && (
        <ServiceRoutesPanel
          routeRows={topRouteRows}
          sortField={routeSortField}
          sortDirection={routeSortDirection}
          onSort={handleRouteSort}
        />
      )}

      {recentTraces.length > 0 && (
        <ServiceTracesPanel
          traces={recentTraces}
          sortField={traceSortField}
          sortDirection={traceSortDirection}
          onSort={handleTraceSort}
          onViewTrace={handleViewTrace}
          onViewAllTraces={handleViewAllTraces}
        />
      )}

      {!loading &&
        routesResult &&
        deployments.length === 0 &&
        routeRows.length === 0 &&
        recentTraces.length === 0 && (
          <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
            <EmptyState
              heading="No data found"
              description={`No routes or traces found for ${serviceName} in the selected time range.`}
              addDataHref={PAGE_MANIFEST.addData.path}
            />
          </Paper>
        )}
    </Box>
  );
}
