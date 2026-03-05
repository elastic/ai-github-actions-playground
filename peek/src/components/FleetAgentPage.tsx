import { useEffect, useMemo, useState } from "react";
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
import { EChart } from "@perses-dev/components";
import { parseAsStringEnum, useQueryState } from "nuqs";

import {
  computeCheckinStaleness,
  type ElasticAgentInfo,
  type ElasticAgentLogEntry,
  type ElasticAgentMetricPoint,
} from "../services/fleet";
import { COMPONENT_HEIGHTS, STATUS_COLORS } from "../types/tokens";
import { formatBytes } from "../utils/formatBytes";
import { useFleetAgentDetail } from "../hooks/useFleetAgentDetail";
import { usePageContextStore } from "../store/usePageContextStore";
import { INSIGHT_GUARDRAIL } from "../hooks/insightPromptUtils";

import ContentSkeleton from "./ContentSkeleton";
import PageHeader from "./PageHeader";
import PageInsightBanner from "./PageInsightBanner";
import EmptyState from "./EmptyState";
import { stalenessSeverityToColor, formatFleetTime } from "./fleet/fleetPresentation";
import { useEChartTheme } from "./visualizations/useEChartTheme";

type AgentTab = "overview" | "logs" | "metrics";
const AGENT_TABS: AgentTab[] = ["overview", "logs", "metrics"];

const LOG_LEVEL_COLORS: Record<string, string> = {
  error: STATUS_COLORS.error,
  warn: STATUS_COLORS.warning,
  warning: STATUS_COLORS.warning,
  info: STATUS_COLORS.info,
  debug: STATUS_COLORS.unknown,
};

export default function FleetAgentPage() {
  const navigate = useNavigate();
  const { agentId = "" } = useParams<{ agentId: string }>();
  const decodedAgentId = (() => {
    try {
      return decodeURIComponent(agentId);
    } catch {
      return agentId;
    }
  })();

  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringEnum<AgentTab>(AGENT_TABS)
      .withDefault("overview")
      .withOptions({ history: "replace" }),
  );
  const [logLevelFilter, setLogLevelFilter] = useState<string | null>(null);

  const agentResult = useFleetAgentDetail(decodedAgentId);

  const loading = agentResult.status === "loading";
  const error = agentResult.status === "error" ? agentResult.error : null;
  const agentInfo = agentResult.status === "success" ? agentResult.data.agentInfo : null;
  const logs = agentResult.status === "success" ? agentResult.data.logs : [];
  const metrics = agentResult.status === "success" ? agentResult.data.metrics : [];

  // Publish screen context for AI chat
  const setPageSection = usePageContextStore((s) => s.setPageSection);
  useEffect(() => {
    if (!agentInfo) return;
    setPageSection("fleetAgent", {
      agentId: agentInfo.agentId,
      hostname: agentInfo.hostname,
      version: agentInfo.version,
      errorCount: agentInfo.errorCount,
    });
  }, [agentInfo, setPageSection]);

  const insightContext = useMemo(() => {
    if (!agentInfo) return "";
    const recentErrors = logs
      .filter((log) => log.level.toLowerCase() === "error")
      .slice(0, 3)
      .map((log) => ({
        timestamp: log.timestamp,
        component: log.component ?? null,
        message: log.message,
      }));
    const latestMetric = metrics[0] ?? null;
    return JSON.stringify({
      agentId: agentInfo.agentId,
      hostname: agentInfo.hostname,
      version: agentInfo.version,
      os: agentInfo.os?.full || agentInfo.os?.name || "unknown",
      errorCount: agentInfo.errorCount,
      logCount: logs.length,
      recentErrorCount: recentErrors.length,
      recentErrors,
      latestCpuPct: latestMetric?.cpuPct ?? null,
      latestMemoryPct: latestMetric?.memoryPct ?? null,
      latestEventsRate: latestMetric?.eventsRate ?? null,
    });
  }, [agentInfo, logs, metrics]);

  const insightCacheKey = `fleet-agent::${decodedAgentId}::${agentInfo?.errorCount ?? ""}::${logs.length}::${metrics.length}::${logs.find((log) => log.level.toLowerCase() === "error")?.timestamp ?? ""}::${metrics[0]?.timestamp ?? ""}`;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%", minHeight: 0 }}>
      {/* Header */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title={agentInfo?.hostname ?? decodedAgentId}
          actions={
            <>
              <Button size="small" variant="text" onClick={() => navigate("/fleet")}>
                ← Fleet
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => void agentResult.refresh()}
                disabled={loading}
              >
                {loading ? <CircularProgress size={16} /> : "Refresh"}
              </Button>
            </>
          }
        />
      </Paper>

      {insightContext && (
        <PageInsightBanner
          context={insightContext}
          systemPrompt={`You are an Elastic Agent health advisor. Summarize this agent's health in one concise sentence. Include hostname, version, OS, and note any error-level logs or concerns.${INSIGHT_GUARDRAIL}`}
          cacheKey={insightCacheKey}
        />
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {loading && !agentInfo ? (
        <ContentSkeleton variant="cards" />
      ) : !agentInfo && !loading ? (
        <Alert severity="warning">
          Agent {decodedAgentId} not found in recent Elastic Agent logs.
        </Alert>
      ) : (
        <>
          <Tabs
            value={activeTab}
            onChange={(_, v: AgentTab) => void setActiveTab(v)}
            sx={{
              minHeight: COMPONENT_HEIGHTS.tab,
              "& .MuiTab-root": { minHeight: COMPONENT_HEIGHTS.tab, py: 0.5 },
            }}
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
          <Typography variant="subtitle1">{agent.hostname}</Typography>
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
        <Typography variant="body2" gutterBottom>
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
          <Typography variant="body2" gutterBottom color="error.main">
            Recent Errors
          </Typography>
          <Stack spacing={0.5}>
            {recentErrors.map((log) => (
              <Box
                key={`${log.timestamp}-${log.component}`}
                sx={{ display: "flex", gap: 1, alignItems: "baseline" }}
              >
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
              bgcolor: levelFilter === level ? LOG_LEVEL_COLORS[level] : undefined,
              color: levelFilter === level ? undefined : LOG_LEVEL_COLORS[level],
            }}
            onClick={() => onLevelFilterChange(levelFilter === level ? null : level)}
          />
        ))}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ alignSelf: "center", ml: "auto" }}
        >
          {filtered.length} log{filtered.length !== 1 ? "s" : ""}
        </Typography>
      </Stack>

      {/* Log entries */}
      <Paper
        variant="outlined"
        sx={{
          maxHeight: "calc(100vh - 300px)",
          overflow: "auto",
          p: 1,
          fontSize: "0.75rem",
          fontFamily: "monospace",
        }}
      >
        {filtered.map((log) => (
          <Box
            key={`${log.timestamp}-${log.message.slice(0, 80)}`}
            sx={{
              display: "flex",
              gap: 1,
              py: 0.5,
              borderBottom: "1px solid",
              borderColor: "divider",
              "&:last-child": { borderBottom: "none" },
            }}
          >
            <Typography
              component="span"
              sx={{
                flexShrink: 0,
                color: "text.secondary",
                fontSize: "inherit",
                fontFamily: "inherit",
              }}
            >
              {formatFleetTime(log.timestamp)}
            </Typography>
            <Typography
              component="span"
              sx={{
                flexShrink: 0,
                minWidth: 40,
                color: LOG_LEVEL_COLORS[log.level.toLowerCase()] ?? "text.primary",
                fontWeight: 600,
                fontSize: "inherit",
                fontFamily: "inherit",
              }}
            >
              {log.level.toUpperCase()}
            </Typography>
            {log.component && (
              <Typography
                component="span"
                sx={{
                  flexShrink: 0,
                  color: "text.secondary",
                  fontSize: "inherit",
                  fontFamily: "inherit",
                }}
              >
                [{log.component}]
              </Typography>
            )}
            <Typography
              component="span"
              sx={{ wordBreak: "break-word", fontSize: "inherit", fontFamily: "inherit" }}
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
      <EmptyState
        size="small"
        heading="No metrics found"
        description="No documents found in metrics-elastic_agent* for this agent."
      />
    );
  }

  const hasAnyChart = cpuOption || memoryOption || eventsOption;
  if (!hasAnyChart) {
    return (
      <EmptyState
        size="small"
        heading="Insufficient metrics data"
        description={`Metrics documents found (${metrics.length}) but no CPU, memory, or events data available.`}
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {cpuOption && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="body2" gutterBottom>
            CPU Usage
          </Typography>
          <Box sx={{ height: 200 }}>
            <EChart
              option={cpuOption}
              theme={theme}
              sx={{ width: "100%", height: "100%", minHeight: 120 }}
            />
          </Box>
        </Paper>
      )}
      {memoryOption && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="body2" gutterBottom>
            Memory Usage
          </Typography>
          <Box sx={{ height: 200 }}>
            <EChart
              option={memoryOption}
              theme={theme}
              sx={{ width: "100%", height: "100%", minHeight: 120 }}
            />
          </Box>
        </Paper>
      )}
      {eventsOption && (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="body2" gutterBottom>
            Events
          </Typography>
          <Box sx={{ height: 200 }}>
            <EChart
              option={eventsOption}
              theme={theme}
              sx={{ width: "100%", height: "100%", minHeight: 120 }}
            />
          </Box>
        </Paper>
      )}
    </Box>
  );
}
