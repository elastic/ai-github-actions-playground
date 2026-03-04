import { useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { INSIGHT_GUARDRAIL } from "../../hooks/insightPromptUtils";
import { PAGE_MANIFEST } from "../../routes/manifest";
import DateRangePicker from "../DateRangePicker";
import EmptyState from "../EmptyState";
import PageHeader from "../PageHeader";
import PageInsightBanner from "../PageInsightBanner";
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";

import { formatLatency, formatErrorRate } from "./serviceInventoryHelpers";
import ServiceOverviewCards from "./ServiceOverviewCards";
import ServicePerformanceCharts from "./ServicePerformanceCharts";
import ServiceInsightsPanel from "./ServiceInsightsPanel";
import ServiceInventoryTable from "./ServiceInventoryTable";
import { useServiceInventorySearch } from "./useServiceInventorySearch";

const MAX_CONTEXT_SERVICES = 50;

function sanitizeTopError(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

export default function ServiceInventoryPage() {
  const {
    filters,
    updateFilters,
    searchResult,
    sparklineData,
    serviceRows,
    sortField,
    sortDirection,
    loading,
    error,
    handleSort,
    handleSearch,
    handleReset,
    handleViewTraces,
    cancelSearch,
  } = useServiceInventorySearch();

  const insightContext = useMemo(() => {
    if (serviceRows.length === 0) return "";
    const slowest = serviceRows.reduce((a, b) => (b.avgLatencyMs > a.avgLatencyMs ? b : a));
    const highestError = serviceRows.reduce((a, b) => (b.errorRate > a.errorRate ? b : a));
    const mostActive = serviceRows.reduce((a, b) => (b.requestCount > a.requestCount ? b : a));
    const contextRows = serviceRows
      .slice()
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, MAX_CONTEXT_SERVICES);
    return JSON.stringify({
      totalServices: serviceRows.length,
      omittedServices: Math.max(0, serviceRows.length - MAX_CONTEXT_SERVICES),
      services: contextRows.map((r) => ({
        name: r.serviceName,
        requests: r.requestCount,
        avgLatencyMs: r.avgLatencyMs,
        errorRate: r.errorRate,
        topError: sanitizeTopError(r.topError),
        language: r.language,
        environment: r.environment,
        version: r.version,
        uniqueVersions: r.uniqueVersions,
      })),
      slowestService: { name: slowest.serviceName, latency: formatLatency(slowest.avgLatencyMs) },
      highestErrorRate: {
        name: highestError.serviceName,
        rate: formatErrorRate(highestError.errorRate),
      },
      mostActiveService: { name: mostActive.serviceName, requests: mostActive.requestCount },
    });
  }, [serviceRows]);

  const insightCacheKey = insightContext;

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
              cancelSearch();
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
            systemPrompt={`You are an APM performance advisor analyzing OpenTelemetry service data. Provide 2-3 concise, actionable insights about service health, latency outliers, error patterns, or resource concerns. Focus on what an SRE should investigate first. Keep it brief.${INSIGHT_GUARDRAIL}`}
            cacheKey={insightCacheKey}
          />
          <ServiceInsightsPanel serviceRows={serviceRows} />
          <ServiceOverviewCards serviceRows={serviceRows} />
          <ServicePerformanceCharts serviceRows={serviceRows} />
          <Paper variant="outlined" sx={{ overflow: "auto" }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                All Services
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Detailed inventory of all discovered services with trend sparklines
              </Typography>
            </Box>
            <ServiceInventoryTable
              serviceRows={serviceRows}
              sortField={sortField}
              sortDirection={sortDirection}
              handleSort={handleSort}
              handleViewTraces={handleViewTraces}
              sparklineData={sparklineData}
            />
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
