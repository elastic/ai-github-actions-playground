import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {
  ElasticsearchClient,
  isElasticsearchError,
  type ClusterInfoResponse,
  type ClusterHealthResponse,
} from "../services/es";
import {
  loadFleetServerStatus,
  loadElasticAgentInventory,
  type FleetServerStatusMetrics,
} from "../services/fleet";
import { useDashboardStore } from "../store/useDashboardStore";

interface OverviewData {
  clusterInfo: ClusterInfoResponse | null;
  clusterHealth: ClusterHealthResponse | null;
  dataStreamCount: number | null;
  indexCount: number | null;
  aliasCount: number | null;
  fleetStatus: FleetServerStatusMetrics | null;
  agentInventoryCount: number | null;
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

export default function ClusterOverviewPage() {
  const connection = useDashboardStore((s) => s.connection);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialErrors, setPartialErrors] = useState<string[]>([]);
  const [data, setData] = useState<OverviewData>({
    clusterInfo: null,
    clusterHealth: null,
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
    try {
      const client = new ElasticsearchClient(connection);
      const [
        clusterInfoResult,
        clusterHealthResult,
        dataStreamsResult,
        resolveIndexResult,
        fleetStatusResult,
        agentInventoryResult,
      ] = await Promise.allSettled([
        client.getClusterInfo(),
        client.getClusterHealth(),
        client.getDataStreams(),
        client.resolveIndex("*"),
        loadFleetServerStatus(client),
        loadElasticAgentInventory(client),
      ]);

      const nextData: OverviewData = {
        clusterInfo: clusterInfoResult.status === "fulfilled" ? clusterInfoResult.value : null,
        clusterHealth:
          clusterHealthResult.status === "fulfilled" ? clusterHealthResult.value : null,
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
      if (dataStreamsResult.status === "rejected") failedParts.push("data streams");
      if (resolveIndexResult.status === "rejected") failedParts.push("indices/aliases");
      if (fleetStatusResult.status === "rejected") failedParts.push("fleet status");
      if (agentInventoryResult.status === "rejected") failedParts.push("agent inventory");
      if (failedParts.length > 0) {
        setPartialErrors(failedParts);
      }

      // Core sources (cluster info/health, data streams, indices) determine total failure.
      // Fleet sources use gracefulSearch and never reject.
      const coreFailures = [
        clusterInfoResult,
        clusterHealthResult,
        dataStreamsResult,
        resolveIndexResult,
      ].filter((r) => r.status === "rejected").length;
      if (coreFailures === 4) {
        const firstError =
          clusterInfoResult.status === "rejected" ? clusterInfoResult.reason : null;
        setError(
          isElasticsearchError(firstError)
            ? firstError.message
            : "Failed to load cluster overview data.",
        );
      }
    } catch (err) {
      setError(isElasticsearchError(err) ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const { clusterInfo } = data;
  const { clusterHealth } = data;
  const clusterStatus = clusterHealth?.status?.toUpperCase() ?? "UNKNOWN";
  const clusterStatusColor =
    clusterHealth?.status === "green"
      ? "success"
      : clusterHealth?.status === "yellow"
        ? "warning"
        : clusterHealth?.status === "red"
          ? "error"
          : "default";

  function renderCount(value: number | null) {
    if (value === null) {
      return (
        <Typography variant="body2" color="text.secondary">
          Unavailable
        </Typography>
      );
    }
    return <Typography variant="h4">{value}</Typography>;
  }

  const fleetTotal = data.fleetStatus?.total ?? data.agentInventoryCount;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" sx={{ flex: 1 }}>
            Cluster Overview
          </Typography>
          <Button size="small" variant="outlined" onClick={loadOverview} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : "Refresh"}
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {!error && partialErrors.length > 0 && (
        <Alert severity="warning">
          Partial data loaded. Unavailable: {partialErrors.join(", ")}.
        </Alert>
      )}

      {loading && !clusterInfo ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <InfoCard title="Cluster">
                {clusterInfo ? (
                  <Stack spacing={1}>
                    <Typography variant="h5">{clusterInfo.cluster_name}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={`UUID: ${clusterInfo.cluster_uuid}`} />
                      <Chip size="small" label={`Node: ${clusterInfo.name}`} />
                      {clusterHealth?.number_of_nodes !== undefined && (
                        <Chip size="small" label={`Nodes: ${clusterHealth.number_of_nodes}`} />
                      )}
                      {clusterHealth?.number_of_data_nodes !== undefined && (
                        <Chip
                          size="small"
                          label={`Data nodes: ${clusterHealth.number_of_data_nodes}`}
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
                    <Typography variant="h5">{clusterInfo.version.number}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={`Lucene: ${clusterInfo.version.lucene_version}`} />
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
                <Typography variant="h4">{fleetTotal}</Typography>
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
