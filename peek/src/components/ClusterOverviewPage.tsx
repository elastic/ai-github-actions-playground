import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useDashboardStore } from "../store/useDashboardStore";

interface OverviewData {
  clusterInfo: ClusterInfoResponse | null;
  clusterHealth: ClusterHealthResponse | null;
  dataStreamCount: number | null;
  indexCount: number | null;
  aliasCount: number | null;
  fleetAgents: FleetAgentSummary[] | null;
  fleetAgentCount: number | null;
}

interface FleetAgentSummary {
  id: string;
  hostname: string;
  status: string;
  policyId: string;
  active: boolean | null;
  lastCheckin: string | null;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialErrors, setPartialErrors] = useState<string[]>([]);
  const [data, setData] = useState<OverviewData>({
    clusterInfo: null,
    clusterHealth: null,
    dataStreamCount: null,
    indexCount: null,
    aliasCount: null,
    fleetAgents: null,
    fleetAgentCount: null,
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
        fleetAgentsResult,
      ] = await Promise.allSettled([
        client.getClusterInfo(),
        client.getClusterHealth(),
        client.getDataStreams(),
        client.resolveIndex("*"),
        loadFleetAgents(client),
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
        fleetAgents: fleetAgentsResult.status === "fulfilled" ? fleetAgentsResult.value : null,
        fleetAgentCount:
          fleetAgentsResult.status === "fulfilled" ? fleetAgentsResult.value.length : null,
      };
      setData(nextData);

      const failedParts: string[] = [];
      if (clusterInfoResult.status === "rejected") failedParts.push("cluster info");
      if (clusterHealthResult.status === "rejected") failedParts.push("cluster health");
      if (dataStreamsResult.status === "rejected") failedParts.push("data streams");
      if (resolveIndexResult.status === "rejected") failedParts.push("indices/aliases");
      if (fleetAgentsResult.status === "rejected") failedParts.push("fleet agents");
      if (failedParts.length > 0) {
        setPartialErrors(failedParts);
      }

      if (failedParts.length === 5) {
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
  const fleetAgentStatusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const agent of data.fleetAgents ?? []) {
      const normalized = agent.status.trim().toLowerCase() || "unknown";
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data.fleetAgents]);

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

            <Box sx={{ flex: 1 }}>
              <InfoCard title="Fleet Agents">{renderCount(data.fleetAgentCount)}</InfoCard>
            </Box>
          </Stack>

          <InfoCard title="Fleet Agent Statuses">
            {data.fleetAgents === null ? (
              <Typography variant="body2" color="text.secondary">
                Unavailable
              </Typography>
            ) : data.fleetAgents.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No Fleet agent documents found in .fleet-agents* or fleet-agents*.
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {fleetAgentStatusCounts.map(([status, count]) => (
                    <Chip
                      key={status}
                      size="small"
                      color={fleetStatusColor(status)}
                      label={`${status}: ${count}`}
                    />
                  ))}
                </Stack>
                <Stack spacing={0.5}>
                  {data.fleetAgents.slice(0, 5).map((agent) => (
                    <Stack
                      key={agent.id}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Chip
                        size="small"
                        label={agent.status}
                        color={fleetStatusColor(agent.status)}
                      />
                      <Typography variant="body2">{agent.hostname}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {agent.id}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Policy: {agent.policyId}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            )}
          </InfoCard>
        </Stack>
      )}
    </Box>
  );
}

function fleetStatusColor(
  status: string,
): "default" | "primary" | "secondary" | "success" | "warning" | "error" {
  const normalized = status.toLowerCase();
  if (normalized === "online") return "success";
  if (normalized === "error") return "error";
  if (normalized === "degraded" || normalized === "warning") return "warning";
  return "default";
}

function readNestedString(
  source: Record<string, unknown>,
  path: string[],
  fallback = "unknown",
): string {
  let current: unknown = source;
  for (const key of path) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return fallback;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" && current.length > 0 ? current : fallback;
}

async function loadFleetAgents(client: ElasticsearchClient): Promise<FleetAgentSummary[]> {
  const response = await client.rawRequest(
    "POST",
    "/.fleet-agents*,fleet-agents*/_search?ignore_unavailable=true&allow_no_indices=true",
    JSON.stringify({
      size: 200,
      sort: [{ last_checkin: { order: "desc", unmapped_type: "date" } }],
      _source: [
        "agent.id",
        "active",
        "policy_id",
        "last_checkin_status",
        "last_checkin",
        "enrolled_at",
        "local_metadata.host.hostname",
      ],
      query: { match_all: {} },
    }),
  );
  if (response.status >= 400) {
    const body = response.body as { error?: { reason?: string } } | null;
    throw {
      status: response.status,
      message: body?.error?.reason ?? "Failed to load Fleet agents.",
    };
  }
  const hits = (
    response.body as {
      hits?: { hits?: Array<{ _id?: string; _source?: Record<string, unknown> }> };
    } | null
  )?.hits?.hits;
  if (!hits) return [];
  return hits.map((hit) => {
    const source = hit._source ?? {};
    return {
      id: readNestedString(source, ["agent", "id"], hit._id ?? "unknown"),
      hostname: readNestedString(source, ["local_metadata", "host", "hostname"]),
      status: readNestedString(source, ["last_checkin_status"]),
      policyId: readNestedString(source, ["policy_id"]),
      active: typeof source.active === "boolean" ? source.active : null,
      lastCheckin: typeof source.last_checkin === "string" ? source.last_checkin : null,
    };
  });
}
