import { useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { INSIGHT_GUARDRAIL, INSIGHT_SPECIFICITY_POLICY } from "../../hooks/insightPromptUtils";
import { usePageSlotInsights } from "../../hooks/usePageSlotInsights";
import { PAGE_MANIFEST } from "../../routes/manifest";
import DateRangePicker from "../DateRangePicker";
import EmptyState from "../EmptyState";
import InsightSlot from "../InsightSlot";
import { InsightSlotProvider } from "../InsightSlotContext";
import PageHeader from "../PageHeader";
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";

import { formatLatency, formatErrorRate } from "./serviceInventoryHelpers";
import ServiceOverviewCards from "./ServiceOverviewCards";
import ServicePerformanceCharts from "./ServicePerformanceCharts";
import ServiceInventoryTable from "./ServiceInventoryTable";
import {
  SERVICE_INSIGHT_SLOTS,
  SERVICE_INSIGHT_SLOT_IDS,
  buildHighestErrorServiceRowInsightSlots,
  buildSlowestServiceRowInsightSlots,
  buildServiceRowInsightSlots,
  serviceRowInsightSlotId,
} from "./serviceInsightSlots";
import { useServiceInventorySearch } from "./useServiceInventorySearch";

const MAX_CONTEXT_SERVICES = 50;
const MAX_ROW_INSIGHT_SLOTS = 30;
const MAX_RANKED_ROW_INSIGHT_SLOTS = 5;

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
    sparklineError,
    getSortLabelProps,
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
    const highErrorServices = serviceRows
      .filter((row) => row.errorRate >= 0.05)
      .map((row) => row.serviceName)
      .slice(0, 10);
    const highLatencyServices = serviceRows
      .filter((row) => row.avgLatencyMs >= 500)
      .map((row) => row.serviceName)
      .slice(0, 10);
    const contextRows = serviceRows
      .slice()
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, MAX_CONTEXT_SERVICES);
    return JSON.stringify({
      page: {
        id: "service-performance",
        purpose:
          "Help SREs identify unhealthy services quickly, prioritize investigation, and drill into traces.",
        primaryUserTasks: [
          "Find high-latency services",
          "Find high-error services",
          "Compare service behavior by language/environment",
          "Drill into traces for a selected service",
        ],
      },
      uiState: {
        filters: {
          timeFrom: filters.timeFrom,
          timeTo: filters.timeTo,
        },
        sort: {
          field: sortField,
          direction: sortDirection,
        },
        resultCount: serviceRows.length,
        sparklineSeriesCount: Object.keys(sparklineData ?? {}).length,
      },
      aggregateSignals: {
        totalServices: serviceRows.length,
        omittedServices: Math.max(0, serviceRows.length - MAX_CONTEXT_SERVICES),
        highErrorServiceCount: highErrorServices.length,
        highLatencyServiceCount: highLatencyServices.length,
        highErrorServices,
        highLatencyServices,
      },
      leaders: {
        slowestService: { name: slowest.serviceName, latency: formatLatency(slowest.avgLatencyMs) },
        highestErrorRate: {
          name: highestError.serviceName,
          rate: formatErrorRate(highestError.errorRate),
        },
        mostActiveService: { name: mostActive.serviceName, requests: mostActive.requestCount },
      },
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
        hasSparkline: Boolean(sparklineData?.[r.serviceName]),
      })),
    });
  }, [serviceRows, filters.timeFrom, filters.timeTo, sortField, sortDirection, sparklineData]);

  const insightCacheKey = insightContext;
  const rowInsightSlots = useMemo(
    () => buildServiceRowInsightSlots(serviceRows, MAX_ROW_INSIGHT_SLOTS),
    [serviceRows],
  );
  const slowestRowInsightSlots = useMemo(
    () => buildSlowestServiceRowInsightSlots(serviceRows, MAX_RANKED_ROW_INSIGHT_SLOTS),
    [serviceRows],
  );
  const highestErrorRowInsightSlots = useMemo(
    () => buildHighestErrorServiceRowInsightSlots(serviceRows, MAX_RANKED_ROW_INSIGHT_SLOTS),
    [serviceRows],
  );
  const insightSlots = useMemo(
    () => [
      ...SERVICE_INSIGHT_SLOTS,
      ...rowInsightSlots,
      ...slowestRowInsightSlots,
      ...highestErrorRowInsightSlots,
    ],
    [rowInsightSlots, slowestRowInsightSlots, highestErrorRowInsightSlots],
  );
  const rowInsightSlotIds = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of serviceRows.slice(0, MAX_ROW_INSIGHT_SLOTS)) {
      map[row.serviceName] = serviceRowInsightSlotId(row.serviceName);
    }
    return map;
  }, [serviceRows]);

  const slotInsights = usePageSlotInsights({
    context: insightContext,
    systemPrompt:
      "You are an APM service performance copilot for SRE workflows. " +
      "Generate one concise, high-signal insight per slot. " +
      "Prioritize anomaly detection, regression hints, and next investigative actions. " +
      "Use only facts from provided context; do not invent data. " +
      "For each slot, explain why that slot matters to triage decisions. " +
      "When relevant, reference concrete service names and metric values from context. " +
      "Do not produce summary-style statements that only repeat totals or healthy-looking numbers. " +
      "If nothing is risky or unusual, explicitly say there is no strong signal and suggest what to monitor next. " +
      INSIGHT_SPECIFICITY_POLICY +
      " Keep each slot insight under 2 sentences." +
      INSIGHT_GUARDRAIL,
    cacheKey: `service-performance-slots::${insightCacheKey}`,
    slots: insightSlots,
    enabled: serviceRows.length > 0,
  });

  return (
    <InsightSlotProvider
      summary={slotInsights.summary}
      insights={slotInsights.insights}
      loading={slotInsights.loading}
      error={slotInsights.error}
      refresh={slotInsights.refresh}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          height: "100%",
          minHeight: 0,
          overflow: "auto",
        }}
      >
        <PageHeader
          title="Service Performance"
          description="Track service latency, throughput, and error trends from OpenTelemetry traces."
        />
        <InsightSlot slotId={SERVICE_INSIGHT_SLOT_IDS.serviceSearch}>
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
              <Button variant="contained" onClick={handleSearch} disabled={loading}>
                {loading ? <CircularProgress size={14} color="inherit" /> : "Search"}
              </Button>
              <Button variant="text" onClick={handleReset} disabled={loading}>
                Reset
              </Button>
              {searchResult && (
                <Typography variant="body2" color="text.secondary">
                  {serviceRows.length} {serviceRows.length === 1 ? "service" : "services"} found
                </Typography>
              )}
            </Box>
          </Paper>
        </InsightSlot>

        {error && <Alert severity="error">{error}</Alert>}
        {!error && sparklineError && (
          <Alert severity="warning">
            Trend sparkline query failed. Showing table data without full trend history.
          </Alert>
        )}

        {!loading && !searchResult && (
          <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
            <EmptyState
              heading="No service data loaded"
              description="Run a search to discover services from your OpenTelemetry traces."
              addDataHref={PAGE_MANIFEST.addData.path}
            />
          </Paper>
        )}

        {!loading && searchResult && serviceRows.length === 0 && (
          <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
            <EmptyState
              heading="No services found"
              description="No services were found in the selected time range. Expand the range or verify ingestion."
              addDataHref={PAGE_MANIFEST.addData.path}
            />
          </Paper>
        )}

        {serviceRows.length > 0 && (
          <Stack spacing={2} sx={{ minHeight: 0 }}>
            <Stack spacing={2}>
              <ServiceOverviewCards serviceRows={serviceRows} />
              <ServicePerformanceCharts serviceRows={serviceRows} sparklineData={sparklineData} />
            </Stack>
            <InsightSlot slotId={SERVICE_INSIGHT_SLOT_IDS.serviceInventory}>
              <Paper
                variant="outlined"
                sx={{
                  minHeight: 280,
                  overflow: "auto",
                }}
              >
                <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Service Inventory
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Compare service request volume, latency, error rate, and trends.
                  </Typography>
                </Box>
                <ServiceInventoryTable
                  serviceRows={serviceRows}
                  getSortLabelProps={getSortLabelProps}
                  handleViewTraces={handleViewTraces}
                  sparklineData={sparklineData}
                  rowInsightSlotIds={rowInsightSlotIds}
                />
              </Paper>
            </InsightSlot>
          </Stack>
        )}
      </Box>
    </InsightSlotProvider>
  );
}
