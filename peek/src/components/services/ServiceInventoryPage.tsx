import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import { useShallow } from "zustand/react/shallow";

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { useConnectionStore } from "../../store/useConnectionStore";
import { useServicesStore } from "../../store/useServicesStore";
import { useTracesStore } from "../../store/useTracesStore";
import { PAGE_MANIFEST } from "../../routes/manifest";
import DateRangePicker from "../DateRangePicker";
import EmptyState from "../EmptyState";
import PageHeader from "../PageHeader";
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";
import type { EsqlResponse } from "../../types";

import { buildServiceInventoryQuery } from "./serviceInventoryQueryBuilder";

interface ServiceRow {
  serviceName: string;
  requestCount: number;
  avgLatencyMs: number;
  errorCount: number;
  errorRate: number;
}

function parseServiceRows(result: EsqlResponse): ServiceRow[] {
  const colIndex = new Map<string, number>();
  for (let i = 0; i < result.columns.length; i++) {
    colIndex.set(result.columns[i]!.name, i);
  }
  const get = (row: unknown[], field: string): unknown => {
    const idx = colIndex.get(field);
    return idx !== undefined ? row[idx] : null;
  };

  return result.values.map((row) => ({
    serviceName: String(get(row, "service.name") ?? "unknown"),
    requestCount: Number(get(row, "request_count") ?? 0),
    avgLatencyMs: Number(get(row, "avg_latency_ms") ?? 0),
    errorCount: Number(get(row, "error_count") ?? 0),
    errorRate: Number(get(row, "error_rate") ?? 0),
  }));
}

function formatLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s`;
  return `${ms.toFixed(1)}ms`;
}

function formatErrorRate(rate: number): string {
  if (!Number.isFinite(rate) || rate < 0) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

type SortField = "serviceName" | "requestCount" | "avgLatencyMs" | "errorRate";
type SortDirection = "asc" | "desc";

export default function ServiceInventoryPage() {
  const navigate = useNavigate();
  const connection = useConnectionStore((s) => s.connection);
  const { filters, searchResult, updateFilters, setSearchResult, resetFilters } = useServicesStore(
    useShallow((s) => ({
      filters: s.filters,
      searchResult: s.searchResult,
      updateFilters: s.updateFilters,
      setSearchResult: s.setSearchResult,
      resetFilters: s.resetFilters,
    })),
  );

  const [sortField, setSortField] = useState<SortField>("requestCount");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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
    (data: EsqlResponse) => setSearchResult(data),
    [setSearchResult],
  );
  const handleFailure = useCallback(() => setSearchResult(null), [setSearchResult]);

  const { runQuery, loading, error } = useEsqlQuery({
    connection,
    onSuccess: handleSuccess,
    onFailure: handleFailure,
  });

  const handleSearch = useCallback(() => {
    const query = buildServiceInventoryQuery(filters);
    runQuery(query);
  }, [filters, runQuery]);

  const handleViewTraces = useCallback(
    (serviceName: string) => {
      useTracesStore.getState().updateFilters({ services: [serviceName] });
      navigate(PAGE_MANIFEST.traces.path);
    },
    [navigate],
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
              updateFilters({ timeFrom: traceRange.from, timeTo: traceRange.to });
            }}
          />
          <Button variant="contained" size="small" onClick={handleSearch} disabled={loading}>
            {loading ? <CircularProgress size={14} color="inherit" /> : "Search"}
          </Button>
          <Button variant="text" size="small" onClick={resetFilters}>
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
          <Table size="small" aria-label="Service inventory">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortField === "serviceName"}
                    direction={sortField === "serviceName" ? sortDirection : "asc"}
                    onClick={() => handleSort("serviceName")}
                  >
                    Service Name
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortField === "requestCount"}
                    direction={sortField === "requestCount" ? sortDirection : "desc"}
                    onClick={() => handleSort("requestCount")}
                  >
                    Requests
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortField === "avgLatencyMs"}
                    direction={sortField === "avgLatencyMs" ? sortDirection : "desc"}
                    onClick={() => handleSort("avgLatencyMs")}
                  >
                    Avg Latency
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortField === "errorRate"}
                    direction={sortField === "errorRate" ? sortDirection : "desc"}
                    onClick={() => handleSort("errorRate")}
                  >
                    Error Rate
                  </TableSortLabel>
                </TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {serviceRows.map((row) => (
                <TableRow
                  key={row.serviceName}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => handleViewTraces(row.serviceName)}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {row.serviceName}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{row.requestCount.toLocaleString()}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{formatLatency(row.avgLatencyMs)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      size="small"
                      label={formatErrorRate(row.errorRate)}
                      color={row.errorRate > 0.05 ? "error" : "default"}
                      variant={row.errorRate > 0.05 ? "filled" : "outlined"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="text"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewTraces(row.serviceName);
                      }}
                    >
                      View Traces
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
