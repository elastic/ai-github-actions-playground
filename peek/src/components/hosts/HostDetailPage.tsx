import { useMemo } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SearchOffIcon from "@mui/icons-material/SearchOff";

import { useSimpleEsqlQuery } from "../../hooks/useSimpleEsqlQuery";
import { usePageFiltersStore } from "../../store/usePageFiltersStore";
import DateRangePicker from "../DateRangePicker";
import EmptyState from "../EmptyState";
import PageHeader from "../PageHeader";
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";

import { buildHostDetailQuery, type HostQueryFilters } from "./hostQueryBuilder";
import { fmtPct, fmtCount, fmtTimestamp, MetricCard } from "./hostFormatters";
import { parseHostInventory } from "./hostHelpers";
import { osLabel } from "./hostTypes";
import HostDetailMetricsGrid from "./HostDetailMetricsGrid";

export default function HostDetailPage() {
  const { hostId } = useParams<{ hostId: string }>();
  const decodedHostId = useMemo(() => {
    if (!hostId) return "";
    try {
      return decodeURIComponent(hostId);
    } catch {
      return hostId;
    }
  }, [hostId]);

  const { filters, updateFilters } = usePageFiltersStore(
    useShallow((s) => ({ filters: s.hostsFilters, updateFilters: s.updateHostsFilters })),
  );

  const queryFilters = useMemo<HostQueryFilters>(
    () => ({ timeFrom: filters.timeFrom, timeTo: filters.timeTo }),
    [filters.timeFrom, filters.timeTo],
  );

  const detailQuery = useMemo(
    () => (decodedHostId ? buildHostDetailQuery(decodedHostId, queryFilters) : null),
    [decodedHostId, queryFilters],
  );
  const { data: searchResult, loading, error } = useSimpleEsqlQuery({ query: detailQuery });

  const hostRow = useMemo(() => {
    if (!searchResult) return null;
    const rows = parseHostInventory(searchResult);
    return rows[0] ?? null;
  }, [searchResult]);

  const descriptionText = hostRow
    ? [osLabel(hostRow.osType), [hostRow.osName, hostRow.osVersion].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(" — ")
    : "Loading host details...";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: "100%" }}>
      <PageHeader
        title={decodedHostId || "Host Detail"}
        leading={
          <Button
            component={RouterLink}
            to="/hosts"
            startIcon={<ArrowBackIcon />}
            size="small"
            sx={{ mr: 1 }}
          >
            Hosts
          </Button>
        }
        description={descriptionText}
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
          {loading && <CircularProgress size={16} />}
        </Box>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !hostRow && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            icon={<SearchOffIcon />}
            heading="No host data found"
            description="No data was found for this host in the selected time range."
          />
        </Paper>
      )}

      {hostRow && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
              Overview
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Host Name
                </Typography>
                <Typography variant="body1">{hostRow.hostName || "—"}</Typography>
              </Box>
              {hostRow.hostIp && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    IP Address
                  </Typography>
                  <Typography variant="body1">{hostRow.hostIp}</Typography>
                </Box>
              )}
              <Box>
                <Typography variant="body2" color="text.secondary">
                  OS
                </Typography>
                <Chip label={osLabel(hostRow.osType)} size="small" variant="outlined" />
              </Box>
              {hostRow.osFull && (
                <Box sx={{ minWidth: 200 }}>
                  <Typography variant="body2" color="text.secondary">
                    OS Version
                  </Typography>
                  <Typography variant="body1" sx={{ fontSize: "0.85rem" }}>
                    {hostRow.osFull}
                  </Typography>
                </Box>
              )}
              {hostRow.hostArch && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Architecture
                  </Typography>
                  <Typography variant="body1">{hostRow.hostArch}</Typography>
                </Box>
              )}
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Last Seen
                </Typography>
                <Typography variant="body1">{fmtTimestamp(hostRow.lastSeen)}</Typography>
              </Box>
            </Box>
          </Paper>

          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Resource Health
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <MetricCard label="CPU Utilization" value={fmtPct(hostRow.cpuUtilization)} />
            <MetricCard label="Memory Utilization" value={fmtPct(hostRow.memoryUtilization)} />
            {hostRow.loadAvg1m != null && (
              <MetricCard label="Load Avg (1m)" value={hostRow.loadAvg1m.toFixed(2)} />
            )}
            {hostRow.processCount != null && (
              <MetricCard label="Processes" value={fmtCount(hostRow.processCount)} />
            )}
          </Box>

          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Metrics Over Time
          </Typography>
          <HostDetailMetricsGrid hostId={decodedHostId} filters={queryFilters} />
        </Box>
      )}
    </Box>
  );
}
