import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
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
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";
import type { EsqlResponse } from "../../types";

import { buildServiceInventoryQuery } from "./serviceInventoryQueryBuilder";
import { type SortField, type SortDirection, parseServiceRows } from "./serviceInventoryHelpers";
import ServiceSummaryPanel from "./ServiceSummaryPanel";
import ServiceInventoryTable from "./ServiceInventoryTable";

export default function ServiceInventoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const connection = useConnectionStore((s) => s.connection);
  const { filters, updateFilters, resetFilters } = usePageFiltersStore(
    useShallow((s) => ({
      filters: s.serviceFilters,
      updateFilters: s.updateServiceFilters,
      resetFilters: s.resetServiceFilters,
    })),
  );

  const { data: searchResult = null } = useQuery<EsqlResponse | null>({
    queryKey: ["services-search"],
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setSearchResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(["services-search"], result),
    [queryClient],
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: "100%" }}>
      <PageHeader
        title="Services"
        description="Service inventory showing key performance metrics from OpenTelemetry trace data."
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

      <ServiceSummaryPanel serviceRows={serviceRows} />

      <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
        {!loading && !searchResult && (
          <EmptyState
            heading="No service data loaded"
            description="Click Search to discover services from your OpenTelemetry trace data."
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        )}

        {!loading && searchResult && serviceRows.length === 0 && (
          <EmptyState
            heading="No services found"
            description="No services were found in the selected time range. Try expanding the time range or check your data ingestion."
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        )}

        {serviceRows.length > 0 && (
          <ServiceInventoryTable
            serviceRows={serviceRows}
            sortField={sortField}
            sortDirection={sortDirection}
            handleSort={handleSort}
            handleViewTraces={handleViewTraces}
          />
        )}
      </Paper>
    </Box>
  );
}
