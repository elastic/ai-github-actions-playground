import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useShallow } from "zustand/react/shallow";
import { useQueryClient, useQuery } from "@tanstack/react-query";

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { useConnectionStore } from "../../store/useConnectionStore";
import { usePageFiltersStore } from "../../store/usePageFiltersStore";
import { useTracesStore } from "../../store/useTracesStore";
import { EMPTY_FILTERS } from "../traces/traceQueryBuilder";
import { PAGE_MANIFEST } from "../../routes/manifest";
import DateRangePicker from "../DateRangePicker";
import EmptyState from "../EmptyState";
import PageHeader from "../PageHeader";
import PageInsightBanner from "../PageInsightBanner";
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";
import type { EsqlResponse } from "../../types";

import { buildServiceInventoryQuery } from "./serviceInventoryQueryBuilder";
import {
  type SortField,
  type SortDirection,
  parseServiceRows,
  formatLatency,
  formatErrorRate,
} from "./serviceInventoryHelpers";
import ServiceOverviewCards from "./ServiceOverviewCards";
import ServicePerformanceCharts from "./ServicePerformanceCharts";
import ServiceBusiestPanel from "./ServiceBusiestPanel";
import ServiceInsightsPanel from "./ServiceInsightsPanel";
import ServiceInventoryTable from "./ServiceInventoryTable";

export default function ServiceInventoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const connection = useConnectionStore((s) => s.connection);
  const { filters, serviceSearchSession, updateFilters, resetFilters } = usePageFiltersStore(
    useShallow((s) => ({
      filters: s.serviceFilters,
      serviceSearchSession: s.serviceSearchSession,
      updateFilters: s.updateServiceFilters,
      resetFilters: s.resetServiceFilters,
    })),
  );
  const serviceSearchQueryKey = useMemo(
    () => ["services-search", serviceSearchSession] as const,
    [serviceSearchSession],
  );

  const { data: searchResult = null } = useQuery<EsqlResponse | null>({
    queryKey: serviceSearchQueryKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setSearchResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(serviceSearchQueryKey, result),
    [queryClient, serviceSearchQueryKey],
  );
  const [sortField, setSortField] = useState<SortField>("requestCount");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const latestQueryRef = useRef<string | null>(null);
  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("desc");
      }
    },
    [sortField],
  );
  const handleSuccess = useCallback(
    (data: EsqlResponse, executedQuery: string) => {
      if (executedQuery !== latestQueryRef.current) return;
      setSearchResult(data);
    },
    [setSearchResult],
  );
  const handleFailure = useCallback(
    (failedQuery: string) => {
      if (failedQuery !== latestQueryRef.current) return;
      setSearchResult(null);
    },
    [setSearchResult],
  );
  const { runQuery, loading, error, clearError } = useEsqlQuery({
    connection,
    onSuccess: handleSuccess,
    onFailure: handleFailure,
  });
  const handleSearch = useCallback(() => {
    const query = buildServiceInventoryQuery(filters);
    latestQueryRef.current = query.trim();
    runQuery(query);
  }, [filters, runQuery]);
  const handleReset = useCallback(() => {
    if (loading) return;
    latestQueryRef.current = null;
    clearError();
    setSearchResult(null);
    resetFilters();
  }, [clearError, resetFilters, loading, setSearchResult]);

  const handleViewTraces = useCallback(
    (serviceName: string) => {
      useTracesStore.getState().setFilters({
        ...EMPTY_FILTERS,
        timeFrom: filters.timeFrom,
        timeTo: filters.timeTo,
        services: [serviceName],
      });
      navigate(PAGE_MANIFEST.traces.path);
    },
    [navigate, filters.timeFrom, filters.timeTo],
  );
  const serviceRows = useMemo(() => {
    if (!searchResult) return [];
    const rows = parseServiceRows(searchResult);
    return rows.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [searchResult, sortField, sortDirection]);

  const insightContext = useMemo(() => {
    if (serviceRows.length === 0) return "";
    const slowest = serviceRows.reduce((a, b) => (b.avgLatencyMs > a.avgLatencyMs ? b : a));
    const highestError = serviceRows.reduce((a, b) => (b.errorRate > a.errorRate ? b : a));
    const mostActive = serviceRows.reduce((a, b) => (b.requestCount > a.requestCount ? b : a));
    return JSON.stringify({
      totalServices: serviceRows.length,
      services: serviceRows.map((r) => ({
        name: r.serviceName,
        requests: r.requestCount,
        avgLatencyMs: r.avgLatencyMs,
        errorRate: r.errorRate,
        topError: r.topError,
        language: r.language,
        environment: r.environment,
      })),
      slowestService: { name: slowest.serviceName, latency: formatLatency(slowest.avgLatencyMs) },
      highestErrorRate: {
        name: highestError.serviceName,
        rate: formatErrorRate(highestError.errorRate),
      },
      mostActiveService: { name: mostActive.serviceName, requests: mostActive.requestCount },
    });
  }, [serviceRows]);

  const insightCacheKey = useMemo(
    () =>
      `services::${serviceRows.length}::${serviceRows
        .map(
          (r) =>
            `${r.serviceName}:${r.requestCount}:${r.avgLatencyMs.toFixed(0)}:${r.errorRate.toFixed(4)}`,
        )
        .join(",")}`,
    [serviceRows],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: "100%" }}>
      <PageHeader
        title="Service Performance"
        description="APM dashboard showing key performance metrics across your services from OpenTelemetry trace data."
      />
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <DateRangePicker
            value={toDashboardTimeRange({ from: filters.timeFrom, to: filters.timeTo })}
            onChange={(range) => {
              const traceRange = toTraceTimeRange(range);
              latestQueryRef.current = null;
              updateFilters({ timeFrom: traceRange.from, timeTo: traceRange.to });
            }}
          />
          <Button variant="contained" size="small" onClick={handleSearch} disabled={loading}>
            {loading ? <CircularProgress size={14} color="inherit" /> : "Search"}
          </Button>
          <Button variant="text" size="small" onClick={handleReset} disabled={loading}>
            Reset
          </Button>
          {searchResult && (
            <Typography variant="body2" color="text.secondary">
              {serviceRows.length} {serviceRows.length === 1 ? "service" : "services"} found
            </Typography>
          )}
        </Box>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !searchResult && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            heading="No service data loaded"
            description="Click Search to discover services from your OpenTelemetry trace data."
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}

      {!loading && searchResult && serviceRows.length === 0 && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            heading="No services found"
            description="No services were found in the selected time range. Try expanding the time range or check your data ingestion."
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}

      {serviceRows.length > 0 && (
        <Stack spacing={2}>
          <PageInsightBanner
            context={insightContext}
            systemPrompt="You are an APM performance advisor analyzing OpenTelemetry service data. Provide 2-3 concise, actionable insights about service health, latency outliers, error patterns, or resource concerns. Focus on what an SRE should investigate first. Keep it brief."
            cacheKey={insightCacheKey}
          />
          <ServiceInsightsPanel serviceRows={serviceRows} />
          <ServiceOverviewCards serviceRows={serviceRows} />
          <ServicePerformanceCharts serviceRows={serviceRows} />
          <ServiceBusiestPanel serviceRows={serviceRows} onViewTraces={handleViewTraces} />
          <Paper variant="outlined" sx={{ overflow: "auto" }}>
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                All Services
              </Typography>
            </Box>
            <ServiceInventoryTable
              serviceRows={serviceRows}
              sortField={sortField}
              sortDirection={sortDirection}
              handleSort={handleSort}
              handleViewTraces={handleViewTraces}
            />
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
