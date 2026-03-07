import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LoadingButton from "./LoadingButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import MemoryIcon from "@mui/icons-material/Memory";

import { NODE_PERMISSION_HEADING, NODE_PERMISSION_DESCRIPTION } from "../constants/nodePermissions";
import WarningIcon from "@mui/icons-material/Warning";

import { useClusterOverview } from "../hooks/useClusterOverview";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";

// ── Role abbreviation map ─────────────────────────────────────────────────

const ROLE_ABBR: Record<string, string> = {
  master: "master",
  data: "data",
  data_hot: "hot",
  data_warm: "warm",
  data_cold: "cold",
  data_frozen: "frozen",
  data_content: "content",
  ingest: "ingest",
  ml: "ml",
  remote_cluster_client: "rcc",
  transform: "transform",
  voting_only: "voting",
  coordinating_only: "coord",
};
const ROLE_LABEL: Record<string, string> = {
  master: "Master",
  data: "Data",
  data_hot: "Data hot",
  data_warm: "Data warm",
  data_cold: "Data cold",
  data_frozen: "Data frozen",
  data_content: "Data content",
  ingest: "Ingest",
  ml: "Machine learning",
  remote_cluster_client: "Remote cluster client",
  transform: "Transform",
  voting_only: "Voting only",
  coordinating_only: "Coordinating only",
};

function abbrevRole(role: string): string {
  return ROLE_ABBR[role] ?? role;
}

function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

// ── Health classification ─────────────────────────────────────────────────

type HealthLevel = "critical" | "warning" | "ok";

const NODE_THRESHOLDS = {
  cpu: { warning: 70, critical: 90 },
  heap: { warning: 75, critical: 90 },
  disk: { warning: 85, critical: 95 },
} as const;

function nodeHealth(row: NodeTableRow): HealthLevel {
  // Critical: heap > 90%, disk > 95%, any breaker trips, any thread rejections
  if (row.heapPercent !== null && row.heapPercent >= NODE_THRESHOLDS.heap.critical)
    return "critical";
  if (row.fsUsedPercent !== null && row.fsUsedPercent >= NODE_THRESHOLDS.disk.critical)
    return "critical";
  if (row.totalBreakerTrips !== null && row.totalBreakerTrips > 0) return "critical";
  if (row.totalThreadRejections !== null && row.totalThreadRejections > 0) return "critical";
  // Warning: heap >= 75%, disk >= 85%
  if (row.heapPercent !== null && row.heapPercent >= NODE_THRESHOLDS.heap.warning) return "warning";
  if (row.fsUsedPercent !== null && row.fsUsedPercent >= NODE_THRESHOLDS.disk.warning)
    return "warning";
  return "ok";
}

function HealthIcon({ level }: { level: HealthLevel }) {
  if (level === "critical")
    return (
      <Tooltip title="Critical: high resource pressure or errors">
        <ErrorIcon fontSize="small" color="error" aria-label="Critical" />
      </Tooltip>
    );
  if (level === "warning")
    return (
      <Tooltip title="Warning: elevated resource usage">
        <WarningIcon fontSize="small" color="warning" aria-label="Warning" />
      </Tooltip>
    );
  return (
    <Tooltip title="OK">
      <CheckCircleIcon fontSize="small" color="success" aria-label="OK" />
    </Tooltip>
  );
}

// ── Metric cell coloring ──────────────────────────────────────────────────

type MetricLevel = "ok" | "warning" | "critical";

function percentLevel(pct: number, warnThreshold: number, critThreshold: number): MetricLevel {
  if (pct >= critThreshold) return "critical";
  if (pct >= warnThreshold) return "warning";
  return "ok";
}

function levelColor(level: MetricLevel): string | undefined {
  if (level === "critical") return "error.main";
  if (level === "warning") return "warning.main";
  return undefined;
}

// ── Row data ──────────────────────────────────────────────────────────────

interface NodeTableRow {
  id: string;
  name: string;
  transportAddress: string | null;
  roles: string[];
  version: string;
  cpuPercent: number | null;
  load1m: number | null;
  heapPercent: number | null;
  gcOldCount: number | null;
  gcOldMs: number | null;
  fsUsedPercent: number | null;
  totalThreadRejections: number | null;
  totalBreakerTrips: number | null;
  docCount: number | null;
  shardCount: number | null;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function NodesPage() {
  const navigate = useNavigate();
  const { result, partialErrors, refresh } = useClusterOverview();
  const loading = result.status === "loading";
  const error = result.status === "error" ? result.error : null;
  const data = result.status === "success" ? result.data : null;
  const nodeDataUnavailable =
    partialErrors.includes("nodes") && partialErrors.includes("node stats");

  const rows = useMemo<NodeTableRow[]>(() => {
    const infoNodes = data?.nodesInfo?.nodes ?? {};
    const statsNodes = data?.nodesStats?.nodes ?? {};
    const ids = Array.from(new Set([...Object.keys(infoNodes), ...Object.keys(statsNodes)])).sort();

    return ids.map((id) => {
      const info = infoNodes[id];
      const stats = statsNodes[id];

      const totalFs = stats?.fs?.total?.total_in_bytes;
      const availFs = stats?.fs?.total?.available_in_bytes;
      const fsUsedPercent =
        totalFs && totalFs > 0 && availFs !== undefined
          ? ((totalFs - availFs) / totalFs) * 100
          : null;

      const rejections = stats?.thread_pool
        ? Object.values(stats.thread_pool).reduce((sum, p) => sum + (p.rejected ?? 0), 0)
        : null;

      const trips = stats?.breakers
        ? Object.values(stats.breakers).reduce((sum, b) => sum + (b.tripped ?? 0), 0)
        : null;

      return {
        id,
        name: info?.name ?? stats?.name ?? id,
        transportAddress: info?.transport_address ?? null,
        roles:
          info?.roles && info.roles.length > 0 ? info.roles : info ? ["coordinating_only"] : [],
        version: info?.version ?? "unknown",
        cpuPercent: stats?.os?.cpu?.percent ?? null,
        load1m: stats?.os?.cpu?.load_average?.["1m"] ?? null,
        heapPercent: stats?.jvm?.mem?.heap_used_percent ?? null,
        gcOldCount: stats?.jvm?.gc?.collectors?.old?.collection_count ?? null,
        gcOldMs: stats?.jvm?.gc?.collectors?.old?.collection_time_in_millis ?? null,
        fsUsedPercent,
        totalThreadRejections: rejections,
        totalBreakerTrips: trips,
        docCount: stats?.indices?.docs?.count ?? null,
        shardCount: stats?.indices?.shard_stats?.total_count ?? null,
      };
    });
  }, [data?.nodesInfo?.nodes, data?.nodesStats?.nodes]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Nodes"
          description="Runtime health and capacity for all Elasticsearch nodes. Click a row to drill into thread pools, circuit breakers, and more."
          actions={
            <LoadingButton size="small" variant="outlined" onClick={refresh} loading={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </LoadingButton>
          }
        />
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {!error && partialErrors.length > 0 && (
        <Alert severity="warning">
          Partial data loaded. Unavailable: {partialErrors.join(", ")}.
        </Alert>
      )}

      {!error && (
        <Paper
          variant="outlined"
          sx={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}
        >
          {rows.length === 0 && !loading && (partialErrors.length === 0 || nodeDataUnavailable) ? (
            <EmptyState
              icon={<MemoryIcon sx={{ fontSize: 28 }} />}
              heading={nodeDataUnavailable ? NODE_PERMISSION_HEADING : "No nodes found"}
              description={
                nodeDataUnavailable
                  ? NODE_PERMISSION_DESCRIPTION
                  : "No node metadata is currently available."
              }
            />
          ) : (
            <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <Table size="small" stickyHeader aria-label="Nodes table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 32, px: 1 }} aria-label="Health" />
                    <TableCell>Name</TableCell>
                    <TableCell>Roles</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell align="right">
                      <Tooltip title="OS CPU utilisation (%)">
                        <span>CPU</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="System load average (1 min)">
                        <span>Load 1m</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="JVM heap used (%)">
                        <span>Heap</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Old-generation GC collections / cumulative time">
                        <span>GC old</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Disk used (%)">
                        <span>Disk</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Total thread-pool rejections across all pools">
                        <span>Rejected</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Total circuit-breaker trips across all breakers">
                        <span>CB trips</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">Docs</TableCell>
                    <TableCell align="right">Shards</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const health = nodeHealth(row);
                    const cpuLevel =
                      row.cpuPercent !== null
                        ? percentLevel(
                            row.cpuPercent,
                            NODE_THRESHOLDS.cpu.warning,
                            NODE_THRESHOLDS.cpu.critical,
                          )
                        : "ok";
                    const heapLevel =
                      row.heapPercent !== null
                        ? percentLevel(
                            row.heapPercent,
                            NODE_THRESHOLDS.heap.warning,
                            NODE_THRESHOLDS.heap.critical,
                          )
                        : "ok";
                    const diskLevel =
                      row.fsUsedPercent !== null
                        ? percentLevel(
                            row.fsUsedPercent,
                            NODE_THRESHOLDS.disk.warning,
                            NODE_THRESHOLDS.disk.critical,
                          )
                        : "ok";
                    return (
                      <TableRow
                        key={row.id}
                        hover
                        tabIndex={0}
                        role="button"
                        aria-label={`Open node details for ${row.name}`}
                        onClick={() => navigate(`/nodes/${encodeURIComponent(row.id)}`)}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" ||
                            event.key === " " ||
                            event.key === "Spacebar"
                          ) {
                            event.preventDefault();
                            navigate(`/nodes/${encodeURIComponent(row.id)}`);
                          }
                        }}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell sx={{ px: 1 }}>
                          <HealthIcon level={health} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap title={`${row.name} (${row.id})`}>
                            {row.name}
                          </Typography>
                          {row.transportAddress && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {row.transportAddress}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {row.roles.length > 0
                              ? row.roles.map((r) => (
                                  <Tooltip key={r} title={roleLabel(r)}>
                                    <Chip
                                      label={abbrevRole(r)}
                                      size="small"
                                      sx={{ fontSize: "0.65rem", height: 18 }}
                                    />
                                  </Tooltip>
                                ))
                              : "—"}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {row.version}
                          </Typography>
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color: levelColor(cpuLevel),
                            fontWeight: cpuLevel !== "ok" ? 600 : undefined,
                          }}
                        >
                          {row.cpuPercent === null ? "n/a" : `${row.cpuPercent.toFixed(0)}%`}
                        </TableCell>
                        <TableCell align="right">
                          {row.load1m === null ? "n/a" : row.load1m.toFixed(2)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color: levelColor(heapLevel),
                            fontWeight: heapLevel !== "ok" ? 600 : undefined,
                          }}
                        >
                          {row.heapPercent === null ? "n/a" : `${row.heapPercent.toFixed(0)}%`}
                        </TableCell>
                        <TableCell align="right">
                          {row.gcOldCount === null ? (
                            "n/a"
                          ) : (
                            <Tooltip
                              title={`${row.gcOldCount.toLocaleString()} collections, ${(row.gcOldMs ?? 0).toLocaleString()} ms total`}
                            >
                              <span>
                                {row.gcOldCount.toLocaleString()} /{" "}
                                {row.gcOldMs !== null
                                  ? row.gcOldMs >= 1000
                                    ? `${(row.gcOldMs / 1000).toFixed(1)}s`
                                    : `${row.gcOldMs}ms`
                                  : "?"}
                              </span>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color: levelColor(diskLevel),
                            fontWeight: diskLevel !== "ok" ? 600 : undefined,
                          }}
                        >
                          {row.fsUsedPercent === null ? "n/a" : `${row.fsUsedPercent.toFixed(0)}%`}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color:
                              row.totalThreadRejections !== null && row.totalThreadRejections > 0
                                ? "error.main"
                                : undefined,
                            fontWeight:
                              row.totalThreadRejections !== null && row.totalThreadRejections > 0
                                ? 600
                                : undefined,
                          }}
                        >
                          {row.totalThreadRejections === null
                            ? "n/a"
                            : row.totalThreadRejections.toLocaleString()}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color:
                              row.totalBreakerTrips !== null && row.totalBreakerTrips > 0
                                ? "error.main"
                                : undefined,
                            fontWeight:
                              row.totalBreakerTrips !== null && row.totalBreakerTrips > 0
                                ? 600
                                : undefined,
                          }}
                        >
                          {row.totalBreakerTrips === null
                            ? "n/a"
                            : row.totalBreakerTrips.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          {row.docCount === null ? "n/a" : row.docCount.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          {row.shardCount === null ? "n/a" : row.shardCount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={13}>
                        <Typography variant="body2" color="text.secondary">
                          Loading node data...
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}
    </Box>
  );
}
