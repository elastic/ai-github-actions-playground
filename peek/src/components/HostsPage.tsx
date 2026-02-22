import { useState, useCallback, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import ComputerIcon from "@mui/icons-material/Computer";
import { useDashboardStore } from "../store/useDashboardStore";
import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import { buildTimeParams } from "../services/datemath";
import type { EsqlResponse, FormatOptions } from "../types";
import TimeSeriesChart from "./visualizations/TimeSeriesChart";

interface HostSummary {
  name: string;
  avgCpu: number | null;
  avgMemory: number | null;
}

interface ChartState {
  loading: boolean;
  data: EsqlResponse | null;
  error: string | null;
}

const EMPTY_CHART: ChartState = { loading: false, data: null, error: null };
const LOADING_CHART: ChartState = { loading: true, data: null, error: null };

function metricColor(value: number | null): "success" | "warning" | "error" | "default" {
  if (value === null) return "default";
  if (value < 0.6) return "success";
  if (value < 0.85) return "warning";
  return "error";
}

function pctLabel(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

export default function HostsPage() {
  const connection = useDashboardStore((s) => s.connection);
  const timeRange = useDashboardStore((s) => s.dashboard.timeRange);

  const [hostSearch, setHostSearch] = useState("");
  const [selectedHost, setSelectedHost] = useState<string | null>(null);

  const [hostList, setHostList] = useState<HostSummary[]>([]);
  const [hostListLoading, setHostListLoading] = useState(false);
  const [hostListError, setHostListError] = useState<string | null>(null);

  const [cpuChart, setCpuChart] = useState<ChartState>(EMPTY_CHART);
  const [memChart, setMemChart] = useState<ChartState>(EMPTY_CHART);
  const [diskChart, setDiskChart] = useState<ChartState>(EMPTY_CHART);
  const [netChart, setNetChart] = useState<ChartState>(EMPTY_CHART);

  const abortRef = useRef<AbortController | null>(null);

  const fetchHostList = useCallback(async () => {
    if (!connection) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setHostListLoading(true);
    setHostListError(null);

    const query = `FROM metrics-*
| STATS avg_cpu = AVG(system.cpu.total.norm.pct), avg_memory = AVG(system.memory.actual.used.pct) BY host.name
| SORT host.name
| LIMIT 500`;

    try {
      const client = new ElasticsearchClient(connection);
      const result = await client.query(
        {
          query,
          filter: {
            range: {
              "@timestamp": { gte: timeRange.from, lte: timeRange.to },
            },
          },
        },
        ctrl.signal,
      );

      if (ctrl.signal.aborted) return;

      const hostNameIdx = result.columns.findIndex((c) => c.name === "host.name");
      const cpuIdx = result.columns.findIndex((c) => c.name === "avg_cpu");
      const memIdx = result.columns.findIndex((c) => c.name === "avg_memory");

      const hosts: HostSummary[] = result.values
        .map((row) => ({
          name: String(row[hostNameIdx] ?? ""),
          avgCpu: cpuIdx >= 0 && row[cpuIdx] !== null ? Number(row[cpuIdx]) : null,
          avgMemory: memIdx >= 0 && row[memIdx] !== null ? Number(row[memIdx]) : null,
        }))
        .filter((h) => h.name !== "");

      setHostList(hosts);
    } catch (err) {
      if (!ctrl.signal.aborted) {
        setHostListError(isElasticsearchError(err) ? err.message : String(err));
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setHostListLoading(false);
      }
    }
  }, [connection, timeRange]);

  const fetchHostDetail = useCallback(
    async (hostname: string) => {
      if (!connection) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const escaped = hostname.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const timeFilter = {
        range: { "@timestamp": { gte: timeRange.from, lte: timeRange.to } },
      };

      const cpuQuery = `FROM metrics-*
| WHERE host.name == "${escaped}"
| STATS cpu = AVG(system.cpu.total.norm.pct) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)
| SORT \`BUCKET(@timestamp, 50, ?_tstart, ?_tend)\``;

      const memQuery = `FROM metrics-*
| WHERE host.name == "${escaped}"
| STATS memory = AVG(system.memory.actual.used.pct) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)
| SORT \`BUCKET(@timestamp, 50, ?_tstart, ?_tend)\``;

      const diskQuery = `FROM metrics-*
| WHERE host.name == "${escaped}"
| STATS read_bytes = AVG(system.diskio.read.bytes), write_bytes = AVG(system.diskio.write.bytes) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)
| SORT \`BUCKET(@timestamp, 50, ?_tstart, ?_tend)\``;

      const netQuery = `FROM metrics-*
| WHERE host.name == "${escaped}"
| STATS in_bytes = AVG(system.network.in.bytes), out_bytes = AVG(system.network.out.bytes) BY BUCKET(@timestamp, 50, ?_tstart, ?_tend)
| SORT \`BUCKET(@timestamp, 50, ?_tstart, ?_tend)\``;

      setCpuChart(LOADING_CHART);
      setMemChart(LOADING_CHART);
      setDiskChart(LOADING_CHART);
      setNetChart(LOADING_CHART);

      const client = new ElasticsearchClient(connection);

      const runChart = async (query: string, setter: (s: ChartState) => void): Promise<void> => {
        try {
          const params = buildTimeParams(query, timeRange);
          const result = await client.query(
            { query, filter: timeFilter, ...(params.length > 0 ? { params } : {}) },
            ctrl.signal,
          );
          if (!ctrl.signal.aborted) {
            setter({ loading: false, data: result, error: null });
          }
        } catch (err) {
          if (!ctrl.signal.aborted) {
            setter({
              loading: false,
              data: null,
              error: isElasticsearchError(err) ? err.message : String(err),
            });
          }
        }
      };

      await Promise.all([
        runChart(cpuQuery, setCpuChart),
        runChart(memQuery, setMemChart),
        runChart(diskQuery, setDiskChart),
        runChart(netQuery, setNetChart),
      ]);
    },
    [connection, timeRange],
  );

  useEffect(() => {
    fetchHostList();
    return () => abortRef.current?.abort();
  }, [fetchHostList]);

  useEffect(() => {
    if (selectedHost) {
      fetchHostDetail(selectedHost);
    }
  }, [selectedHost, fetchHostDetail]);

  const handleSelectHost = useCallback((hostname: string) => {
    setSelectedHost(hostname);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedHost(null);
    setCpuChart(EMPTY_CHART);
    setMemChart(EMPTY_CHART);
    setDiskChart(EMPTY_CHART);
    setNetChart(EMPTY_CHART);
  }, []);

  const handleRefresh = useCallback(() => {
    if (selectedHost) {
      fetchHostDetail(selectedHost);
    } else {
      fetchHostList();
    }
  }, [selectedHost, fetchHostDetail, fetchHostList]);

  const filteredHosts = hostSearch.trim()
    ? hostList.filter((h) => h.name.toLowerCase().includes(hostSearch.trim().toLowerCase()))
    : hostList;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", gap: 1 }}>
      {/* Toolbar */}
      <Paper variant="outlined" sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
        {selectedHost ? (
          <>
            <IconButton size="small" onClick={handleBack} aria-label="back to host list">
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <ComputerIcon fontSize="small" sx={{ color: "text.secondary" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {selectedHost}
            </Typography>
          </>
        ) : (
          <>
            <ComputerIcon fontSize="small" sx={{ color: "text.secondary" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Hosts
            </Typography>
            {!hostListLoading && hostList.length > 0 && (
              <Chip
                label={`${hostList.length} host${hostList.length === 1 ? "" : "s"}`}
                size="small"
              />
            )}
          </>
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={handleRefresh} aria-label="refresh">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>

      {hostListError && !selectedHost && <Alert severity="error">{hostListError}</Alert>}

      <Box sx={{ display: "flex", flex: 1, gap: 1, overflow: "hidden", minHeight: 0 }}>
        {/* Host list sidebar */}
        <Paper
          variant="outlined"
          sx={{
            width: 260,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: "divider" }}>
            <TextField
              size="small"
              placeholder="Search hosts…"
              value={hostSearch}
              onChange={(e) => setHostSearch(e.target.value)}
              fullWidth
            />
          </Box>

          <Box sx={{ flex: 1, overflow: "auto" }}>
            {hostListLoading && hostList.length === 0 ? (
              <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : filteredHosts.length === 0 ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ p: 2, display: "block", textAlign: "center" }}
              >
                {hostSearch ? "No matching hosts" : "No hosts found in the current time range"}
              </Typography>
            ) : (
              filteredHosts.map((host) => (
                <Box key={host.name}>
                  <Box
                    sx={{
                      px: 1.5,
                      py: 1,
                      cursor: "pointer",
                      bgcolor: selectedHost === host.name ? "action.selected" : "transparent",
                      "&:hover": { bgcolor: "action.hover" },
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1,
                    }}
                    onClick={() => handleSelectHost(host.name)}
                  >
                    <ComputerIcon
                      sx={{ fontSize: 16, mt: 0.25, color: "text.secondary", flexShrink: 0 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        noWrap
                        title={host.name}
                        sx={{ fontWeight: selectedHost === host.name ? 600 : 400 }}
                      >
                        {host.name}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                        <Tooltip title="Average CPU usage">
                          <Chip
                            label={`CPU ${pctLabel(host.avgCpu)}`}
                            size="small"
                            color={metricColor(host.avgCpu)}
                            sx={{
                              height: 18,
                              fontSize: "0.65rem",
                              "& .MuiChip-label": { px: 0.75 },
                            }}
                          />
                        </Tooltip>
                        <Tooltip title="Average memory usage">
                          <Chip
                            label={`Mem ${pctLabel(host.avgMemory)}`}
                            size="small"
                            color={metricColor(host.avgMemory)}
                            sx={{
                              height: 18,
                              fontSize: "0.65rem",
                              "& .MuiChip-label": { px: 0.75 },
                            }}
                          />
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>
                  <Divider />
                </Box>
              ))
            )}
          </Box>
        </Paper>

        {/* Detail area */}
        <Box sx={{ flex: 1, overflow: "auto", minWidth: 0 }}>
          {!selectedHost ? (
            <Paper
              variant="outlined"
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                color: "text.secondary",
              }}
            >
              <ComputerIcon sx={{ fontSize: 40, opacity: 0.3 }} />
              <Typography variant="body2" color="text.secondary">
                Select a host to view details
              </Typography>
              {!hostListLoading && hostList.length === 0 && !hostListError && (
                <Box sx={{ textAlign: "center", mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    No hosts were found. Make sure metrics are being collected
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    from <strong>metrics-*</strong> indices with <strong>host.name</strong> fields.
                  </Typography>
                  <Button size="small" variant="outlined" sx={{ mt: 1 }} onClick={fetchHostList}>
                    Retry
                  </Button>
                </Box>
              )}
            </Paper>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "1fr 1fr",
                gap: 1,
                height: "100%",
                minHeight: 400,
              }}
            >
              <HostChart
                title="CPU Usage"
                subtitle="system.cpu.total.norm.pct"
                state={cpuChart}
                format={{ unit: "percent" }}
              />
              <HostChart
                title="Memory Usage"
                subtitle="system.memory.actual.used.pct"
                state={memChart}
                format={{ unit: "percent" }}
              />
              <HostChart
                title="Disk I/O"
                subtitle="system.diskio read/write bytes"
                state={diskChart}
                format={{ unit: "bytes", shortValues: true }}
              />
              <HostChart
                title="Network I/O"
                subtitle="system.network in/out bytes"
                state={netChart}
                format={{ unit: "bytes", shortValues: true }}
              />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

interface HostChartProps {
  title: string;
  subtitle: string;
  state: ChartState;
  format?: FormatOptions;
}

function HostChart({ title, subtitle, state, format }: HostChartProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 180,
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        {state.loading && <CircularProgress size={14} sx={{ ml: "auto" }} />}
      </Box>
      <Box sx={{ flex: 1, position: "relative", p: 0.5 }}>
        {state.loading && !state.data ? (
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}
          >
            <CircularProgress size={28} />
          </Box>
        ) : state.error ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              p: 1,
            }}
          >
            <Typography variant="caption" color="error" textAlign="center">
              {state.error}
            </Typography>
          </Box>
        ) : state.data && state.data.columns.length > 0 ? (
          <TimeSeriesChart data={state.data} options={{ smooth: true, showArea: true, format }} />
        ) : (
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}
          >
            <Typography variant="caption" color="text.secondary">
              No data available
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
