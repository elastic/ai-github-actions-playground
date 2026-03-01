import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
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

import {
  isElasticsearchError,
  type ClusterHealthResponse,
  type ClusterInfoResponse,
  type ClusterStatsResponse,
  type NodeStatsNode,
  type NodesInfoNode,
  type NodesInfoResponse,
  type NodesStatsResponse,
} from "../services/es";
import {
  loadFleetServerStatus,
  loadElasticAgentInventory,
  type FleetServerStatusMetrics,
} from "../services/fleet";
import { useConnectionStore } from "../store/useConnectionStore";
import { formatBytes } from "../utils/formatBytes";
import { runConnectionRequest } from "../hooks/useConnectionRequest";

import ContentSkeleton from "./ContentSkeleton";
import PageHeader from "./PageHeader";

interface OverviewData {
  clusterInfo: ClusterInfoResponse | null;
  clusterHealth: ClusterHealthResponse | null;
  clusterStats: ClusterStatsResponse | null;
  nodesInfo: NodesInfoResponse | null;
  nodesStats: NodesStatsResponse | null;
  dataStreamCount: number | null;
  indexCount: number | null;
  aliasCount: number | null;
  fleetStatus: FleetServerStatusMetrics | null;
  agentInventoryCount: number | null;
}

interface NodeRow {
  id: string;
  name: string;
  roles: string[];
  cpuPercent: number | null;
  heapPercent: number | null;
  diskUsedPercent: number | null;
  shardCount: number | null;
  docCount: number | null;
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}
        gutterBottom
        component="div"
      >
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function formatCompactNumber(value: number | null): string {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatPercent(value: number | null): string {
  if (value === null) return "Unavailable";
  return `${value.toFixed(0)}%`;
}

const NODE_STAT_UNAVAILABLE_HINT =
  "Node stats unavailable — requires the monitor cluster privilege";

function renderNodeStat(formatted: string) {
  if (formatted === "Unavailable") {
    return (
      <Tooltip title={NODE_STAT_UNAVAILABLE_HINT} arrow>
        <Typography variant="body2" component="span" color="text.secondary">
          Unavailable
        </Typography>
      </Tooltip>
    );
  }
  return formatted;
}

function renderCount(value: number | null) {
  if (value === null) {
    return (
      <Typography variant="body2" color="text.secondary">
        Unavailable
      </Typography>
    );
  }
  return (
    <Typography variant="h4" component="p">
      {value.toLocaleString()}
    </Typography>
  );
}

function toNodeRows(
  nodesInfo: NodesInfoResponse | null,
  nodesStats: NodesStatsResponse | null,
): NodeRow[] {
  const infoById = nodesInfo?.nodes ?? {};
  const statsById = nodesStats?.nodes ?? {};
  const ids = Array.from(new Set([...Object.keys(infoById), ...Object.keys(statsById)])).sort();

  return ids.map((id) => {
    const info: NodesInfoNode | undefined = infoById[id];
    const stats: NodeStatsNode | undefined = statsById[id];
    const totalBytes = stats?.fs?.total?.total_in_bytes;
    const availableBytes = stats?.fs?.total?.available_in_bytes;
    const diskUsedPercent =
      totalBytes && totalBytes > 0 && availableBytes !== undefined
        ? ((totalBytes - availableBytes) / totalBytes) * 100
        : null;

    return {
      id,
      name: info?.name ?? stats?.name ?? id,
      roles: info?.roles ?? [],
      cpuPercent: stats?.os?.cpu?.percent ?? null,
      heapPercent: stats?.jvm?.mem?.heap_used_percent ?? null,
      diskUsedPercent,
      shardCount: stats?.indices?.shard_stats?.total_count ?? null,
      docCount: stats?.indices?.docs?.count ?? null,
    };
  });
}

export default function ClusterOverviewPage() {
  const connection = useConnectionStore((s) => s.connection);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialErrors, setPartialErrors] = useState<string[]>([]);
  const [partialDismissed, setPartialDismissed] = useState(false);
  const [data, setData] = useState<OverviewData>({
    clusterInfo: null,
    clusterHealth: null,
    clusterStats: null,
    nodesInfo: null,
    nodesStats: null,
    dataStreamCount: null,
    indexCount: null,
    aliasCount: null,
    fleetStatus: null,
    agentInventoryCount: null,
  });

  const loadOverview = useCallback(async () => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    setPartialErrors([]);
    setPartialDismissed(false);
    try {
      const { data: results, error } = await runConnectionRequest({
        connection,
        run: (client) =>
          Promise.allSettled([
            client.getClusterInfo(),
            client.getClusterHealth(),
            client.getClusterStats(),
            client.getNodes(),
            client.getNodeStats(),
            client.getDataStreams(),
            client.resolveIndex("*"),
            loadFleetServerStatus(client),
            loadElasticAgentInventory(client),
          ]),
      });
      if (error !== null) {
        setError(error);
      } else if (results !== null) {
        const [
          clusterInfoResult,
          clusterHealthResult,
          clusterStatsResult,
          nodesResult,
          nodeStatsResult,
          dataStreamsResult,
          resolveIndexResult,
          fleetStatusResult,
          agentInventoryResult,
        ] = results;

        const nextData: OverviewData = {
          clusterInfo: clusterInfoResult.status === "fulfilled" ? clusterInfoResult.value : null,
          clusterHealth:
            clusterHealthResult.status === "fulfilled" ? clusterHealthResult.value : null,
          clusterStats: clusterStatsResult.status === "fulfilled" ? clusterStatsResult.value : null,
          nodesInfo: nodesResult.status === "fulfilled" ? nodesResult.value : null,
          nodesStats: nodeStatsResult.status === "fulfilled" ? nodeStatsResult.value : null,
          dataStreamCount:
            dataStreamsResult.status === "fulfilled"
              ? (dataStreamsResult.value.data_streams?.length ?? 0)
              : null,
          indexCount:
            resolveIndexResult.status === "fulfilled"
              ? (resolveIndexResult.value.indices?.length ?? 0)
              : null,
          aliasCount:
            resolveIndexResult.status === "fulfilled"
              ? (resolveIndexResult.value.aliases?.length ?? 0)
              : null,
          fleetStatus: fleetStatusResult.status === "fulfilled" ? fleetStatusResult.value : null,
          agentInventoryCount:
            agentInventoryResult.status === "fulfilled" ? agentInventoryResult.value.total : null,
        };
        setData(nextData);

        const failedParts: string[] = [];
        if (clusterInfoResult.status === "rejected") failedParts.push("cluster info");
        if (clusterHealthResult.status === "rejected") failedParts.push("cluster health");
        if (clusterStatsResult.status === "rejected") failedParts.push("cluster stats");
        if (nodesResult.status === "rejected") failedParts.push("nodes");
        if (nodeStatsResult.status === "rejected") failedParts.push("node stats");
        if (dataStreamsResult.status === "rejected") failedParts.push("data streams");
        if (resolveIndexResult.status === "rejected") failedParts.push("indices/aliases");
        if (fleetStatusResult.status === "rejected") failedParts.push("fleet status");
        if (agentInventoryResult.status === "rejected") failedParts.push("agent inventory");
        if (failedParts.length > 0) {
          setPartialErrors(failedParts);
        }

        if (failedParts.length === 9) {
          const firstError =
            clusterInfoResult.status === "rejected" ? clusterInfoResult.reason : null;
          setError(
            isElasticsearchError(firstError)
              ? firstError.message
              : "Failed to load cluster overview data.",
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const { clusterInfo, clusterHealth, clusterStats } = data;
  const clusterStatus = clusterHealth?.status?.toUpperCase() ?? "UNKNOWN";
  const clusterStatusColor =
    clusterHealth?.status === "green"
      ? "success"
      : clusterHealth?.status === "yellow"
        ? "warning"
        : clusterHealth?.status === "red"
          ? "error"
          : "default";

  const nodeRows = useMemo(
    () => toNodeRows(data.nodesInfo, data.nodesStats),
    [data.nodesInfo, data.nodesStats],
  );

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of nodeRows) {
      for (const role of row.roles) {
        counts.set(role, (counts.get(role) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [nodeRows]);

  const clusterDocsCount = clusterStats?.indices?.docs?.count ?? null;
  const clusterStoreBytes = clusterStats?.indices?.store?.size_in_bytes ?? null;
  const clusterShardCount = clusterStats?.indices?.shards?.total ?? null;
  const clusterIndexCount = clusterStats?.indices?.count ?? null;

  const fleetTotal = data.fleetStatus?.total ?? data.agentInventoryCount;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Cluster Overview"
          actions={
            <Button size="small" variant="outlined" onClick={loadOverview} disabled={loading}>
              {loading ? <CircularProgress size={16} /> : "Refresh"}
            </Button>
          }
        />
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {!error && partialErrors.length > 0 && !partialDismissed && (
        <Alert severity="warning" onClose={() => setPartialDismissed(true)}>
          Partial data loaded. Unavailable: {partialErrors.join(", ")}.
        </Alert>
      )}

      {loading && !clusterInfo ? (
        <ContentSkeleton variant="cards" />
      ) : (
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <InfoCard title="Cluster">
                {clusterInfo ? (
                  <Stack spacing={1}>
                    <Typography variant="h5" component="div">
                      {clusterInfo.cluster_name}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={`UUID: ${clusterInfo.cluster_uuid}`} />
                      <Chip size="small" label={`Node: ${clusterInfo.name ?? "unknown"}`} />
                      {clusterHealth?.number_of_nodes !== undefined && (
                        <Chip size="small" label={`Nodes: ${clusterHealth.number_of_nodes}`} />
                      )}
                      {clusterHealth?.number_of_data_nodes !== undefined && (
                        <Chip
                          size="small"
                          label={`Data nodes: ${clusterHealth.number_of_data_nodes}`}
                        />
                      )}
                      {clusterStats?.nodes?.count?.total !== undefined && (
                        <Chip
                          size="small"
                          label={`Discovered nodes: ${clusterStats.nodes.count.total}`}
                        />
                      )}
                    </Stack>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No cluster info available.
                  </Typography>
                )}
              </InfoCard>
            </Box>

            <Box sx={{ flex: 1 }}>
              <InfoCard title="Version">
                {clusterInfo?.version ? (
                  <Stack spacing={1}>
                    <Typography variant="h5" component="div">
                      {clusterInfo.version.number}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={`Lucene: ${clusterInfo.version.lucene_version ?? "unknown"}`}
                      />
                      <Chip
                        size="small"
                        label={`Build: ${clusterInfo.version.build_hash?.slice(0, 7) ?? "unknown"}`}
                      />
                    </Stack>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No version info available.
                  </Typography>
                )}
              </InfoCard>
            </Box>
          </Stack>

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <InfoCard title="Health">
                {clusterHealth ? (
                  <Stack spacing={1}>
                    <Chip
                      size="small"
                      color={clusterStatusColor}
                      label={`Status: ${clusterStatus}`}
                      sx={{ width: "fit-content" }}
                    />
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {clusterHealth.active_primary_shards !== undefined && (
                        <Chip
                          size="small"
                          label={`Primary shards: ${clusterHealth.active_primary_shards}`}
                        />
                      )}
                      {clusterHealth.unassigned_shards !== undefined && (
                        <Chip
                          size="small"
                          label={`Unassigned shards: ${clusterHealth.unassigned_shards}`}
                        />
                      )}
                    </Stack>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No cluster health available.
                  </Typography>
                )}
              </InfoCard>
            </Box>

            <Box sx={{ flex: 1 }}>
              <InfoCard title="Data Streams">{renderCount(data.dataStreamCount)}</InfoCard>
            </Box>

            <Box sx={{ flex: 1 }}>
              <InfoCard title="Indices">{renderCount(data.indexCount)}</InfoCard>
            </Box>

            <Box sx={{ flex: 1 }}>
              <InfoCard title="Aliases">{renderCount(data.aliasCount)}</InfoCard>
            </Box>
          </Stack>

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <InfoCard title="Docs">
                <Typography variant="h4" component="p">
                  {formatCompactNumber(clusterDocsCount)}
                </Typography>
              </InfoCard>
            </Box>
            <Box sx={{ flex: 1 }}>
              <InfoCard title="Store Size">
                <Typography variant="h4" component="p">
                  {formatBytes(clusterStoreBytes, "Unavailable")}
                </Typography>
              </InfoCard>
            </Box>
            <Box sx={{ flex: 1 }}>
              <InfoCard title="Total Shards">
                <Typography variant="h4" component="p">
                  {formatCompactNumber(clusterShardCount)}
                </Typography>
              </InfoCard>
            </Box>
            <Box sx={{ flex: 1 }}>
              <InfoCard title="Total Indices">
                <Typography variant="h4" component="p">
                  {formatCompactNumber(clusterIndexCount)}
                </Typography>
              </InfoCard>
            </Box>
          </Stack>

          <InfoCard title="Node Role Summary">
            {roleCounts.length > 0 ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {roleCounts.map(([role, count]) => (
                  <Chip key={role} size="small" label={`${role}: ${count}`} />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Unavailable
              </Typography>
            )}
          </InfoCard>

          <InfoCard title="Nodes">
            {nodeRows.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Roles</TableCell>
                      <TableCell align="right">CPU %</TableCell>
                      <TableCell align="right">Heap %</TableCell>
                      <TableCell align="right">Disk Used %</TableCell>
                      <TableCell align="right">Shards</TableCell>
                      <TableCell align="right">Docs</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {nodeRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.roles.length > 0 ? row.roles.join(", ") : "—"}</TableCell>
                        <TableCell align="right">
                          {renderNodeStat(formatPercent(row.cpuPercent))}
                        </TableCell>
                        <TableCell align="right">
                          {renderNodeStat(formatPercent(row.heapPercent))}
                        </TableCell>
                        <TableCell align="right">
                          {renderNodeStat(formatPercent(row.diskUsedPercent))}
                        </TableCell>
                        <TableCell align="right">
                          {renderNodeStat(formatCompactNumber(row.shardCount))}
                        </TableCell>
                        <TableCell align="right">
                          {renderNodeStat(formatCompactNumber(row.docCount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Unavailable
              </Typography>
            )}
          </InfoCard>

          {/* Fleet summary */}
          <InfoCard title="Fleet">
            {data.fleetStatus ? (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`Total: ${data.fleetStatus.total}`} color="primary" />
                  <Chip
                    size="small"
                    label={`Healthy: ${data.fleetStatus.healthy}`}
                    color="success"
                  />
                  {data.fleetStatus.unhealthy > 0 && (
                    <Chip
                      size="small"
                      label={`Unhealthy: ${data.fleetStatus.unhealthy}`}
                      color="warning"
                    />
                  )}
                  {data.fleetStatus.offline > 0 && (
                    <Chip size="small" label={`Offline: ${data.fleetStatus.offline}`} />
                  )}
                  {data.fleetStatus.updating > 0 && (
                    <Chip
                      size="small"
                      label={`Updating: ${data.fleetStatus.updating}`}
                      color="info"
                    />
                  )}
                </Stack>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => navigate("/fleet")}
                  sx={{ alignSelf: "flex-start" }}
                >
                  View Fleet →
                </Button>
              </Stack>
            ) : fleetTotal !== null ? (
              <Stack spacing={1}>
                <Typography variant="h4" component="p">
                  {fleetTotal}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  agent{fleetTotal !== 1 ? "s" : ""} detected from Elastic Agent logs
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => navigate("/fleet")}
                  sx={{ alignSelf: "flex-start" }}
                >
                  View Fleet →
                </Button>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No Fleet data available.
              </Typography>
            )}
          </InfoCard>
        </Stack>
      )}
    </Box>
  );
}
