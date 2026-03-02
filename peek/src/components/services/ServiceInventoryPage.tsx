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
  uniqueRoutes: number;
  uniqueSpanNames: number;
  topRoute: string;
  topSpanName: string;
  topError: string;
  language: string;
  environment: string;
}

function parseTopValue(value: unknown, fallback = "—"): string {
  if (Array.isArray(value)) {
    const top = value.find((item) => item != null && String(item).trim() !== "");
    return top != null ? String(top) : fallback;
  }
  if (value == null) return fallback;
  const parsed = String(value).trim();
  return parsed.length > 0 ? parsed : fallback;
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
    uniqueRoutes: Number(get(row, "unique_routes") ?? 0),
    uniqueSpanNames: Number(get(row, "unique_span_names") ?? 0),
    topRoute: parseTopValue(get(row, "top_route")),
    topSpanName: parseTopValue(get(row, "top_span_name")),
    topError: parseTopValue(get(row, "top_error")),
    language: parseTopValue(get(row, "language"), "unknown"),
    environment: parseTopValue(get(row, "environment"), "unknown"),
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

  const summary = useMemo(() => {
    if (serviceRows.length === 0) return null;
    const totals = serviceRows.reduce(
      (acc, row) => {
        acc.requests += row.requestCount;
        acc.errors += row.errorCount;
        return acc;
      },
      { requests: 0, errors: 0 },
    );
    const avgLatencyMs =
      serviceRows.reduce((acc, row) => acc + row.avgLatencyMs, 0) / serviceRows.length;
    return {
      totalRequests: totals.requests,
      totalErrors: totals.errors,
      overallErrorRate: totals.requests > 0 ? totals.errors / totals.requests : 0,
      avgLatencyMs,
      busiestServices: [...serviceRows]
        .sort((a, b) => b.requestCount - a.requestCount)
        .slice(0, 3)
        .map((row) => `${row.serviceName} (${row.requestCount.toLocaleString()})`),
    };
  }, [serviceRows]);

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

      {summary && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Total Requests:{" "}
              <Typography
                component="span"
                variant="body2"
                sx={{ color: "text.primary", fontWeight: 600 }}
              >
                {summary.totalRequests.toLocaleString()}
              </Typography>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Avg Service Latency:{" "}
              <Typography
                component="span"
                variant="body2"
                sx={{ color: "text.primary", fontWeight: 600 }}
              >
                {formatLatency(summary.avgLatencyMs)}
              </Typography>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Overall Error Rate:{" "}
              <Typography
                component="span"
                variant="body2"
                sx={{ color: "text.primary", fontWeight: 600 }}
              >
                {formatErrorRate(summary.overallErrorRate)}
              </Typography>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Busiest Services:
            </Typography>
            {summary.busiestServices.map((service) => (
              <Chip key={service} size="small" label={service} variant="outlined" />
            ))}
          </Box>
        </Paper>
      )}

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
                <TableCell>Language</TableCell>
                <TableCell>Environment</TableCell>
                <TableCell align="right">Routes</TableCell>
                <TableCell align="right">Span Names</TableCell>
                <TableCell>Top Route</TableCell>
                <TableCell>Top Span</TableCell>
                <TableCell>Top Error</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {serviceRows.map((row) => (
                <TableRow
                  key={row.serviceName}
                  hover
                  tabIndex={0}
                  role="button"
                  aria-label={`View traces for ${row.serviceName}`}
                  sx={{ cursor: "pointer" }}
                  onClick={() => handleViewTraces(row.serviceName)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleViewTraces(row.serviceName);
                    }
                  }}
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
                  <TableCell>
                    <Typography variant="body2">{row.language}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.environment}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{row.uniqueRoutes.toLocaleString()}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{row.uniqueSpanNames.toLocaleString()}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.topRoute}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.topSpanName}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.topError}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="text"
                      aria-label={`View traces for ${row.serviceName}`}
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
