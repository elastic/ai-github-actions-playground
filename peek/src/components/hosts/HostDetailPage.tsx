import { useCallback, useMemo, useRef } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import { useConnectionStore } from "../../store/useConnectionStore";
import { usePageFiltersStore } from "../../store/usePageFiltersStore";
import type { EsqlResponse } from "../../types";
import EmptyState from "../EmptyState";
import PageHeader from "../PageHeader";

import { buildHostDetailQuery } from "./hostQueryBuilder";
import { fmtPct, fmtCount, fmtTimestamp, MetricCard } from "./hostFormatters";
import { parseHostInventory } from "./hostHelpers";
import { osLabel } from "./hostTypes";

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
  const queryClient = useQueryClient();
  const connection = useConnectionStore((s) => s.connection);
  const { filters } = usePageFiltersStore(useShallow((s) => ({ filters: s.hostsFilters })));

  const cacheKey = useMemo(
    () =>
      ["host-detail", connection?.url, decodedHostId, filters.timeFrom, filters.timeTo] as const,
    [connection?.url, decodedHostId, filters.timeFrom, filters.timeTo],
  );
  const { data: searchResult = null } = useQuery<EsqlResponse | null>({
    queryKey: cacheKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setSearchResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(cacheKey, result),
    [queryClient, cacheKey],
  );

  const latestQueryRef = useRef<string | null>(null);
  const dispatchedConnectionRef = useRef<string | null>(null);

  const handleSuccess = useCallback(
    (data: EsqlResponse, executedQuery: string) => {
      if (executedQuery !== latestQueryRef.current) return;
      if (dispatchedConnectionRef.current !== connection?.url) return;
      setSearchResult(data);
    },
    [setSearchResult, connection?.url],
  );
  const handleFailure = useCallback(
    (failedQuery: string) => {
      if (failedQuery !== latestQueryRef.current) return;
      if (dispatchedConnectionRef.current !== connection?.url) return;
      setSearchResult(null);
    },
    [setSearchResult, connection?.url],
  );
  const { runQuery, loading, error } = useEsqlQuery({
    connection,
    onSuccess: handleSuccess,
    onFailure: handleFailure,
  });

  const handleSearch = useCallback(() => {
    if (!decodedHostId) return;
    const query = buildHostDetailQuery(decodedHostId, {
      timeFrom: filters.timeFrom,
      timeTo: filters.timeTo,
    });
    latestQueryRef.current = query.trim();
    dispatchedConnectionRef.current = connection?.url ?? null;
    runQuery(query);
  }, [decodedHostId, filters, runQuery, connection?.url]);

  const hostRow = useMemo(() => {
    if (!searchResult) return null;
    const rows = parseHostInventory(searchResult);
    return rows[0] ?? null;
  }, [searchResult]);

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
        description={
          hostRow
            ? [
                osLabel(hostRow.osType),
                [hostRow.osName, hostRow.osVersion].filter(Boolean).join(" "),
              ]
                .filter(Boolean)
                .join(" — ")
            : "Load host details to view resource metrics."
        }
      />

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <Button variant="contained" onClick={handleSearch} disabled={loading}>
            {loading ? <CircularProgress size={14} color="inherit" /> : "Load Host Data"}
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !hostRow && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            icon={<SearchOffIcon />}
            heading="No host data loaded"
            description="Click Load Host Data to fetch the latest snapshot for this host."
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
                  Host ID
                </Typography>
                <Typography variant="body1">{hostRow.hostId}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Host Name
                </Typography>
                <Typography variant="body1">{hostRow.hostName || "—"}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  OS
                </Typography>
                <Chip label={osLabel(hostRow.osType)} size="small" variant="outlined" />
              </Box>
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
            {hostRow.processCount != null && (
              <MetricCard label="Processes" value={fmtCount(hostRow.processCount)} />
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
