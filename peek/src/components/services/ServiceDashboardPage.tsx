import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQueryClient, useQuery } from "@tanstack/react-query";

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { useConnectionStore } from "../../store/useConnectionStore";
import { useTracesStore } from "../../store/useTracesStore";
import { EMPTY_FILTERS } from "../traces/traceQueryBuilder";
import { PAGE_MANIFEST } from "../../routes/manifest";
import DateRangePicker from "../DateRangePicker";
import EmptyState from "../EmptyState";
import PageHeader from "../PageHeader";
import { OverviewInfoCard } from "../OverviewInfoCard";
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";
import type { EsqlResponse } from "../../types";

import { formatLatency, formatErrorRate } from "./serviceInventoryHelpers";
import {
  buildServiceRoutesQuery,
  buildServiceRecentTracesQuery,
} from "./serviceDashboardQueryBuilder";
import {
  type RouteSortField,
  type TraceSortField,
  type SortDirection,
  parseRouteRows,
  parseRecentTraces,
} from "./serviceDashboardHelpers";
import ServiceRoutesTable from "./ServiceRoutesTable";
import ServiceTracesTable from "./ServiceTracesTable";

export default function ServiceDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { serviceName: rawServiceName = "" } = useParams<{ serviceName: string }>();
  const serviceName = (() => {
    try {
      return decodeURIComponent(rawServiceName);
    } catch {
      return rawServiceName;
    }
  })();

  const connection = useConnectionStore((s) => s.connection);

  const [timeFrom, setTimeFrom] = useState("NOW() - 1 hour");
  const [timeTo, setTimeTo] = useState("NOW()");

  // Routes query state
  const [routesSession] = useState(0);
  const routesQueryKey = useMemo(
    () => ["service-dashboard-routes", serviceName, routesSession] as const,
    [serviceName, routesSession],
  );
  const { data: routesResult = null } = useQuery<EsqlResponse | null>({
    queryKey: routesQueryKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setRoutesResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(routesQueryKey, result),
    [queryClient, routesQueryKey],
  );

  // Traces query state
  const [tracesSession] = useState(0);
  const tracesQueryKey = useMemo(
    () => ["service-dashboard-traces", serviceName, tracesSession] as const,
    [serviceName, tracesSession],
  );
  const { data: tracesResult = null } = useQuery<EsqlResponse | null>({
    queryKey: tracesQueryKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setTracesResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(tracesQueryKey, result),
    [queryClient, tracesQueryKey],
  );

  // Sort state
  const [routeSortField, setRouteSortField] = useState<RouteSortField>("requestCount");
  const [routeSortDirection, setRouteSortDirection] = useState<SortDirection>("desc");
  const [traceSortField, setTraceSortField] = useState<TraceSortField>("timestamp");
  const [traceSortDirection, setTraceSortDirection] = useState<SortDirection>("desc");

  const latestRoutesQueryRef = useRef<string | null>(null);
  const latestTracesQueryRef = useRef<string | null>(null);

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

  const {
    runQuery: runRoutesQuery,
    loading: routesLoading,
    error: routesError,
    clearError: clearRoutesError,
  } = useEsqlQuery({
    connection,
    onSuccess: useCallback(
      (data: EsqlResponse, executedQuery: string) => {
        if (executedQuery !== latestRoutesQueryRef.current) return;
        setRoutesResult(data);
      },
      [setRoutesResult],
    ),
    onFailure: useCallback(
      (failedQuery: string) => {
        if (failedQuery !== latestRoutesQueryRef.current) return;
        setRoutesResult(null);
      },
      [setRoutesResult],
    ),
  });

  const {
    runQuery: runTracesQuery,
    loading: tracesLoading,
    error: tracesError,
    clearError: clearTracesError,
  } = useEsqlQuery({
    connection,
    onSuccess: useCallback(
      (data: EsqlResponse, executedQuery: string) => {
        if (executedQuery !== latestTracesQueryRef.current) return;
        setTracesResult(data);
      },
      [setTracesResult],
    ),
    onFailure: useCallback(
      (failedQuery: string) => {
        if (failedQuery !== latestTracesQueryRef.current) return;
        setTracesResult(null);
      },
      [setTracesResult],
    ),
  });

  const loading = routesLoading || tracesLoading;

  const handleSearch = useCallback(() => {
    const filters = { serviceName, timeFrom, timeTo };
    const routesQuery = buildServiceRoutesQuery(filters);
    latestRoutesQueryRef.current = routesQuery.trim();
    runRoutesQuery(routesQuery);
    const tracesQuery = buildServiceRecentTracesQuery(filters);
    latestTracesQueryRef.current = tracesQuery.trim();
    runTracesQuery(tracesQuery);
  }, [serviceName, timeFrom, timeTo, runRoutesQuery, runTracesQuery]);

  const handleReset = useCallback(() => {
    if (loading) return;
    latestRoutesQueryRef.current = null;
    latestTracesQueryRef.current = null;
    clearRoutesError();
    clearTracesError();
    setRoutesResult(null);
    setTracesResult(null);
  }, [clearRoutesError, clearTracesError, loading, setRoutesResult, setTracesResult]);

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

  // Parsed data
  const routeRows = useMemo(() => {
    if (!routesResult) return [];
    const rows = parseRouteRows(routesResult);
    return rows.sort((a, b) => {
      const aVal = a[routeSortField];
      const bVal = b[routeSortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return routeSortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return routeSortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [routesResult, routeSortField, routeSortDirection]);

  const recentTraces = useMemo(() => {
    if (!tracesResult) return [];
    const traces = parseRecentTraces(tracesResult);
    return traces.sort((a, b) => {
      const aVal = a[traceSortField];
      const bVal = b[traceSortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return traceSortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return traceSortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [tracesResult, traceSortField, traceSortDirection]);

  // Summary metrics from route rows
  const summary = useMemo(() => {
    if (routeRows.length === 0) return null;
    const totals = routeRows.reduce(
      (acc, row) => {
        acc.requests += row.requestCount;
        acc.errors += row.errorCount;
        return acc;
      },
      { requests: 0, errors: 0 },
    );
    const avgLatencyMs =
      totals.requests > 0
        ? routeRows.reduce((acc, row) => acc + row.avgLatencyMs * row.requestCount, 0) /
          totals.requests
        : 0;
    return {
      totalRequests: totals.requests,
      totalErrors: totals.errors,
      overallErrorRate: totals.requests > 0 ? totals.errors / totals.requests : 0,
      avgLatencyMs,
      uniqueRoutes: routeRows.length,
    };
  }, [routeRows]);

  const error = routesError || tracesError;

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

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <DateRangePicker
            value={toDashboardTimeRange({ from: timeFrom, to: timeTo })}
            onChange={(range) => {
              const traceRange = toTraceTimeRange(range);
              latestRoutesQueryRef.current = null;
              latestTracesQueryRef.current = null;
              setTimeFrom(traceRange.from);
              setTimeTo(traceRange.to);
            }}
          />
          <Button variant="contained" size="small" onClick={handleSearch} disabled={loading}>
            {loading ? <CircularProgress size={14} color="inherit" /> : "Search"}
          </Button>
          <Button variant="text" size="small" onClick={handleReset} disabled={loading}>
            Reset
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !routesResult && !tracesResult && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            heading="No service data loaded"
            description={`Click Search to load performance data for ${serviceName}.`}
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}

      {summary && (
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Box sx={{ flex: 1 }}>
            <OverviewInfoCard title="Total Requests">
              <Typography variant="h5" component="p">
                {summary.totalRequests.toLocaleString()}
              </Typography>
            </OverviewInfoCard>
          </Box>
          <Box sx={{ flex: 1 }}>
            <OverviewInfoCard title="Avg Latency">
              <Typography variant="h5" component="p">
                {formatLatency(summary.avgLatencyMs)}
              </Typography>
            </OverviewInfoCard>
          </Box>
          <Box sx={{ flex: 1 }}>
            <OverviewInfoCard title="Error Rate">
              <Typography
                variant="h5"
                component="p"
                sx={{ color: summary.overallErrorRate > 0.05 ? "error.main" : "text.primary" }}
              >
                {formatErrorRate(summary.overallErrorRate)}
              </Typography>
            </OverviewInfoCard>
          </Box>
          <Box sx={{ flex: 1 }}>
            <OverviewInfoCard title="Unique Routes">
              <Typography variant="h5" component="p">
                {summary.uniqueRoutes}
              </Typography>
            </OverviewInfoCard>
          </Box>
        </Stack>
      )}

      {routeRows.length > 0 && (
        <Paper variant="outlined" sx={{ overflow: "auto" }}>
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Top Routes
            </Typography>
          </Box>
          <ServiceRoutesTable
            routeRows={routeRows}
            sortField={routeSortField}
            sortDirection={routeSortDirection}
            onSort={handleRouteSort}
          />
        </Paper>
      )}

      {recentTraces.length > 0 && (
        <Paper variant="outlined" sx={{ overflow: "auto" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              p: 1.5,
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Recent Traces
            </Typography>
            <Button size="small" variant="text" onClick={handleViewAllTraces}>
              View All Traces →
            </Button>
          </Box>
          <ServiceTracesTable
            traces={recentTraces}
            sortField={traceSortField}
            sortDirection={traceSortDirection}
            onSort={handleTraceSort}
            onViewTrace={handleViewTrace}
          />
        </Paper>
      )}

      {!loading && routesResult && routeRows.length === 0 && recentTraces.length === 0 && (
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
