import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import {
  computeCheckinStaleness,
  loadElasticAgentInfo,
  loadElasticAgentLogs,
  loadElasticAgentMetrics,
  type ElasticAgentInfo,
  type ElasticAgentLogEntry,
  type ElasticAgentMetricPoint,
} from "../services/fleet";
import { useConnectionStore } from "../store/useConnectionStore";
import { formatBytes } from "../utils/formatBytes";

import { stalenessSeverityToColor, formatFleetTime } from "./fleet/fleetPresentation";
import { useEChartTheme } from "./visualizations/useEChartTheme";
import EChartWrapper from "./visualizations/EChartWrapper";

type AgentTab = "overview" | "logs" | "metrics";

const LOG_LEVEL_COLORS: Record<string, string> = {
  error: "#f44336",
  warn: "#ff9800",
  warning: "#ff9800",
  info: "#2196f3",
  debug: "#9e9e9e",
};

export default function FleetAgentPage() {
  const connection = useConnectionStore((s) => s.connection);
  const navigate = useNavigate();
  const { agentId = "" } = useParams<{ agentId: string }>();
  const decodedAgentId = (() => {
    try {
      return decodeURIComponent(agentId);
    } catch {
      return agentId;
    }
  })();

  const [activeTab, setActiveTab] = useState<AgentTab>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agentInfo, setAgentInfo] = useState<ElasticAgentInfo | null>(null);
  const [logs, setLogs] = useState<ElasticAgentLogEntry[]>([]);
  const [metrics, setMetrics] = useState<ElasticAgentMetricPoint[]>([]);
  const [logLevelFilter, setLogLevelFilter] = useState<string | null>(null);

  const loadAgentData = useCallback(async () => {
    if (!connection || !decodedAgentId) return;
    setLoading(true);
    setError(null);
    try {
      const client = new ElasticsearchClient(connection);
      const [agent, agentLogs, agentMetrics] = await Promise.all([
        loadElasticAgentInfo(client, decodedAgentId),
        loadElasticAgentLogs(client, decodedAgentId, { size: 200 }),
        loadElasticAgentMetrics(client, decodedAgentId, 60),
      ]);
      const fallbackAgent =
        !agent && (agentLogs.length > 0 || agentMetrics.length > 0)
          ? {
              agentId: decodedAgentId,
              hostname: decodedAgentId,
              version: "unknown",
              os: null,
              lastSeen: agentLogs[0]?.timestamp ?? agentMetrics[0]?.timestamp ?? "",
              logCount: agentLogs.length,
              errorCount: agentLogs.filter((entry) => entry.level.toLowerCase() === "error").length,
            }
          : null;
      setAgentInfo(agent ?? fallbackAgent);
      setLogs(agentLogs);
      setMetrics(agentMetrics);
    } catch (err) {
      setError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connection, decodedAgentId]);

  useEffect(() => {
    void loadAgentData();
  }, [loadAgentData]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minHeight: 0, height: "100%" }}>
      {/* Header */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" variant="text" onClick={() => navigate("/fleet")}>
            ← Fleet
          </Button>
          <Typography variant="h6" component="h1" sx={{ flex: 1 }} noWrap>
            {agentInfo?.hostname ?? decodedAgentId}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void loadAgentData()}
            disabled={loading}
          >
            {loading ? <CircularProgress size={16} /> : "Refresh"}
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && !agentInfo ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : !agentInfo && !loading ? (
        <Alert severity="warning">
          Agent {decodedAgentId} not found in recent Elastic Agent logs.
        </Alert>
      ) : (
        <>
          <Tabs
            value={activeTab}
            onChange={(_, v: AgentTab) => setActiveTab(v)}
            sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5 } }}
          >
            <Tab value="overview" label="Overview" />
            <Tab value="logs" label={`Logs (${logs.length})`} />
            <Tab value="metrics" label="Metrics" />
          </Tabs>

          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            {activeTab === "overview" && agentInfo && (
              <AgentOverview agent={agentInfo} logs={logs} />
            )}
            {activeTab === "logs" && (
              <AgentLogs
                logs={logs}
                levelFilter={logLevelFilter}
                onLevelFilterChange={setLogLevelFilter}
              />
            )}
            {activeTab === "metrics" && <AgentMetrics metrics={metrics} />}
          </Box>
        </>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Agent Overview
// ---------------------------------------------------------------------------

function AgentOverview({ agent, logs }: { agent: ElasticAgentInfo; logs: ElasticAgentLogEntry[] }) {
  const staleness = computeCheckinStaleness(agent.lastSeen);

  const levelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) {
      const level = log.level.toLowerCase();
      counts.set(level, (counts.get(level) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [logs]);

  const recentErrors = useMemo(
    () => logs.filter((l) => l.level.toLowerCase() === "error").slice(0, 5),
    [logs],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* Agent info */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack spacing={1}>
          <Typography variant="h6">{agent.hostname}</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={agent.agentId} />
            <Chip size="small" label={`v${agent.version}`} color="primary" variant="outlined" />
            {agent.os && (
              <Chip size="small" label={agent.os.full || agent.os.name} variant="outlined" />
            )}
            <Chip
              size="small"
              label={`Last seen: ${staleness.label}`}
              color={stalenessSeverityToColor(staleness.severity)}
              variant="outlined"
            />
          </Stack>
        </Stack>
      </Paper>

      {/* Log level breakdown */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" gutterBottom>
          Log Level Breakdown
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {levelCounts.map(([level, count]) => (
            <Chip
              key={level}
              size="small"
              label={`${level}: ${count}`}
              sx={{
                borderColor: LOG_LEVEL_COLORS[level] ?? undefined,
                color: LOG_LEVEL_COLORS[level] ?? undefined,
              }}
              variant="outlined"
            />
          ))}
          {levelCounts.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No logs found
            </Typography>
          )}
        </Stack>
      </Paper>

      {/* Recent errors */}
      {recentErrors.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" gutterBottom color="error.main">
            Recent Errors
          </Typography>
          <Stack spacing={0.5}>
            {recentErrors.map((log, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {formatFleetTime(log.timestamp)}
                </Typography>
                {log.component && (
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    [{log.component}]
                  </Typography>
                )}
                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                  {log.message}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Agent Logs
// ---------------------------------------------------------------------------

function AgentLogs({
  logs,
  levelFilter,
  onLevelFilterChange,
}: {
  logs: ElasticAgentLogEntry[];
  levelFilter: string | null;
  onLevelFilterChange: (level: string | null) => void;
}) {
  const uniqueLevels = useMemo(() => {
    const levels = new Set(logs.map((l) => l.level.toLowerCase()));
    return [...levels].sort();
  }, [logs]);

  const filtered = useMemo(
    () => (levelFilter ? logs.filter((l) => l.level.toLowerCase() === levelFilter) : logs),
    [logs, levelFilter],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {/* Level filter chips */}
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {uniqueLevels.map((level) => (
          <Chip
            key={level}
            size="small"
            label={level}
            variant={levelFilter === level ? "filled" : "outlined"}
            sx={{
              borderColor: LOG_LEVEL_COLORS[level],
              color: levelFilter === level ? undefined : LOG_LEVEL_COLORS[level],
              bgcolor: levelFilter === level ? LOG_LEVEL_COLORS[level] : undefined,
            }}
            onClick={() => onLevelFilterChange(levelFilter === level ? null : level)}
          />
        ))}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: "auto", alignSelf: "center" }}
        >
          {filtered.length} log{filtered.length !== 1 ? "s" : ""}
        </Typography>
      </Stack>

      {/* Log entries */}
      <Paper
        variant="outlined"
        sx={{
          p: 1,
          maxHeight: "calc(100vh - 300px)",
          overflow: "auto",
          fontFamily: "monospace",
          fontSize: "0.75rem",
        }}
      >
        {filtered.map((log, i) => (
          <Box
            key={i}
            sx={{
              display: "flex",
              gap: 1,
              py: 0.25,
              borderBottom: "1px solid",
              borderColor: "divider",
              "&:last-child": { borderBottom: "none" },
            }}
          >
            <Typography
              component="span"
              sx={{
                fontSize: "inherit",
                fontFamily: "inherit",
                color: "text.secondary",
                flexShrink: 0,
              }}
            >
              {formatFleetTime(log.timestamp)}
            </Typography>
            <Typography
              component="span"
              sx={{
                fontSize: "inherit",
                fontFamily: "inherit",
                fontWeight: 600,
                color: LOG_LEVEL_COLORS[log.level.toLowerCase()] ?? "text.primary",
                flexShrink: 0,
                minWidth: 40,
              }}
            >
              {log.level.toUpperCase()}
            </Typography>
            {log.component && (
              <Typography
                component="span"
                sx={{
                  fontSize: "inherit",
                  fontFamily: "inherit",
                  color: "text.secondary",
                  flexShrink: 0,
                }}
              >
                [{log.component}]
              </Typography>
            )}
            <Typography
              component="span"
              sx={{ fontSize: "inherit", fontFamily: "inherit", wordBreak: "break-word" }}
            >
              {log.message}
            </Typography>
          </Box>
        ))}
        {filtered.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No logs found for this agent.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Agent Metrics
// ---------------------------------------------------------------------------

function AgentMetrics({ metrics }: { metrics: ElasticAgentMetricPoint[] }) {
  const theme = useEChartTheme();

  const cpuOption = useMemo(() => {
    const sorted = [...metrics].reverse();
    const hasCpu = sorted.some((m) => m.cpuPct !== null);
    if (!hasCpu) return null;
    return {
      ...theme,
      tooltip: { ...theme.tooltip, trigger: "axis" },
      grid: { left: 50, right: 20, top: 30, bottom: 30 },
      xAxis: {
        ...theme.xAxis,
        type: "category",
        data: sorted.map((m) => formatFleetTime(m.timestamp)),
        axisLabel: { ...theme.xAxis?.axisLabel, rotate: 30, fontSize: 10 },
      },
      yAxis: { ...theme.yAxis, type: "value", name: "CPU %", axisLabel: { formatter: "{value}%" } },
      series: [
        {
          type: "line",
          data: sorted.map((m) => (m.cpuPct !== null ? +(m.cpuPct * 100).toFixed(2) : null)),
          smooth: true,
          areaStyle: { opacity: 0.15 },
        },
      ],
    };
  }, [metrics, theme]);

  const memoryOption = useMemo(() => {
    const sorted = [...metrics].reverse();
    const hasMemory = sorted.some((m) => m.memoryPct !== null);
    if (!hasMemory) return null;
    return {
      ...theme,
      tooltip: { ...theme.tooltip, trigger: "axis" },
      grid: { left: 60, right: 20, top: 30, bottom: 30 },
      xAxis: {
        ...theme.xAxis,
        type: "category",
        data: sorted.map((m) => formatFleetTime(m.timestamp)),
        axisLabel: { ...theme.xAxis?.axisLabel, rotate: 30, fontSize: 10 },
      },
      yAxis: {
        ...theme.yAxis,
        type: "value",
        name: "Memory (bytes)",
        axisLabel: { formatter: (v: number) => formatBytes(v, "") },
      },
      series: [
        {
          type: "line",
          data: sorted.map((m) => m.memoryPct),
          smooth: true,
          areaStyle: { opacity: 0.15 },
        },
      ],
    };
  }, [metrics, theme]);

  const eventsOption = useMemo(() => {
    const sorted = [...metrics].reverse();
    const hasEvents = sorted.some((m) => m.eventsRate !== null);
    if (!hasEvents) return null;
    return {
      ...theme,
      tooltip: { ...theme.tooltip, trigger: "axis" },
      grid: { left: 60, right: 20, top: 30, bottom: 30 },
      xAxis: {
        ...theme.xAxis,
        type: "category",
        data: sorted.map((m) => formatFleetTime(m.timestamp)),
        axisLabel: { ...theme.xAxis?.axisLabel, rotate: 30, fontSize: 10 },
      },
      yAxis: { ...theme.yAxis, type: "value", name: "Events Total" },
      series: [
        {
          type: "line",
          data: sorted.map((m) => m.eventsRate),
          smooth: true,
          areaStyle: { opacity: 0.15 },
        },
      ],
    };
  }, [metrics, theme]);

  if (metrics.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        No metrics found in metrics-elastic_agent* for this agent.
      </Typography>
    );
  }

  const hasAnyChart = cpuOption || memoryOption || eventsOption;
  if (!hasAnyChart) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        Metrics documents found ({metrics.length}) but no CPU, memory, or events data available.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {cpuOption && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" gutterBottom>
            CPU Usage
          </Typography>
          <Box sx={{ height: 200 }}>
            <EChartWrapper option={cpuOption} style={{ width: "100%", height: "100%" }} />
          </Box>
        </Paper>
      )}
      {memoryOption && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" gutterBottom>
            Memory Usage
          </Typography>
          <Box sx={{ height: 200 }}>
            <EChartWrapper option={memoryOption} style={{ width: "100%", height: "100%" }} />
          </Box>
        </Paper>
      )}
      {eventsOption && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" gutterBottom>
            Events
          </Typography>
          <Box sx={{ height: 200 }}>
            <EChartWrapper option={eventsOption} style={{ width: "100%", height: "100%" }} />
          </Box>
        </Paper>
      )}
    </Box>
  );
}
