import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { useClusterOverview } from "../hooks/useClusterOverview";
import { useHealthChecks } from "../hooks/useHealthChecks";
import { usePageContextStore } from "../store/usePageContextStore";
import { formatBytes } from "../utils/formatBytes";
import { formatCompactNumber, toNodeRows } from "../utils/clusterOverviewUtils";
import { INSIGHT_GUARDRAIL } from "../hooks/insightPromptUtils";

import AskAiButton from "./AskAiButton";
import ContentSkeleton from "./ContentSkeleton";
import PageHeader from "./PageHeader";
import PageInsightBanner from "./PageInsightBanner";
import { OverviewInfoCard } from "./OverviewInfoCard";
import { OverviewNodesTable } from "./OverviewNodesTable";

function renderCount(value: number | null) {
  if (value === null) {
    return (
      <Typography variant="body2" color="text.secondary">
        Unavailable
      </Typography>
    );
  }
  return (
    <Typography variant="h5" component="p">
      {value.toLocaleString()}
    </Typography>
  );
}

export default function ClusterOverviewPage() {
  const navigate = useNavigate();
  const { result, partialErrors, refresh } = useClusterOverview();
  const [dismissedPartialErrorsKey, setDismissedPartialErrorsKey] = useState<string | null>(null);

  const loading = result.status === "loading";
  const error = result.status === "error" ? result.error : null;
  const data = result.status === "success" ? result.data : null;

  const { clusterInfo, clusterHealth, clusterStats } = data ?? {
    clusterInfo: null,
    clusterHealth: null,
    clusterStats: null,
  };
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
    () => toNodeRows(data?.nodesInfo ?? null, data?.nodesStats ?? null),
    [data?.nodesInfo, data?.nodesStats],
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

  const fleetTotal = data?.fleetStatus?.total ?? data?.agentInventoryCount ?? null;
  const { checks: localChecks } = useHealthChecks({
    surface: "local",
    checkIds: ["cluster.status.red", "cluster.status.yellow", "cluster.unassigned_shards"],
  });
  const nonPassingLocalChecks = localChecks.filter((check) => check.status !== "pass");

  const partialErrorsKey = partialErrors.join("|");

  // Publish screen context for AI chat
  const setPageSection = usePageContextStore((s) => s.setPageSection);
  useEffect(() => {
    if (!data) return;
    setPageSection("clusterOverview", {
      status: clusterHealth?.status ?? "unknown",
      nodeCount: clusterHealth?.number_of_nodes ?? 0,
      indexCount: clusterStats?.indices?.count ?? 0,
      storeSize: formatBytes(clusterStats?.indices?.store?.size_in_bytes ?? null, "unknown"),
    });
  }, [data, clusterHealth, clusterStats, setPageSection]);

  const insightContext = useMemo(() => {
    if (!data) return "";
    return JSON.stringify({
      clusterName: clusterInfo?.cluster_name ?? "unknown",
      status: clusterHealth?.status ?? "unknown",
      nodeCount: clusterHealth?.number_of_nodes ?? 0,
      docsCount: clusterDocsCount,
      shardCount: clusterShardCount,
      storeSize: formatBytes(clusterStoreBytes, "unknown"),
      indexCount: clusterIndexCount,
    });
  }, [
    data,
    clusterInfo,
    clusterHealth,
    clusterDocsCount,
    clusterShardCount,
    clusterStoreBytes,
    clusterIndexCount,
  ]);

  const insightCacheKey = `cluster-overview::${clusterHealth?.status ?? ""}::${clusterHealth?.number_of_nodes ?? ""}`;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Cluster Overview"
          actions={
            <>
              <AskAiButton
                prompt="Based on the current cluster state, what are the top 3 things I should investigate or optimize?"
                label="What should I look at?"
              />
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setDismissedPartialErrorsKey(null);
                  refresh();
                }}
                startIcon={loading ? <CircularProgress size={14} aria-hidden="true" /> : undefined}
                aria-label={loading ? "Refreshing cluster overview" : "Refresh cluster overview"}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </>
          }
        />
      </Paper>

      {insightContext && (
        <PageInsightBanner
          context={insightContext}
          systemPrompt={`You are an Elasticsearch cluster health advisor. Summarize the cluster state in one concise sentence including cluster name, health status, node count, doc count, shard count, and store size. Keep it factual and brief.${INSIGHT_GUARDRAIL}`}
          cacheKey={insightCacheKey}
          severity={
            clusterHealth?.status === "green"
              ? "success"
              : clusterHealth?.status === "yellow"
                ? "warning"
                : clusterHealth?.status === "red"
                  ? "error"
                  : "info"
          }
        />
      )}

      {error && <Alert severity="error">{error}</Alert>}
      {!error && partialErrors.length > 0 && dismissedPartialErrorsKey !== partialErrorsKey && (
        <Alert severity="warning" onClose={() => setDismissedPartialErrorsKey(partialErrorsKey)}>
          Partial data loaded. Unavailable: {partialErrors.join(", ")}.
        </Alert>
      )}

      {loading && !clusterInfo ? (
        <ContentSkeleton variant="cards" />
      ) : (
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <OverviewInfoCard title="Cluster">
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
              </OverviewInfoCard>
            </Box>

            <Box sx={{ flex: 1 }}>
              <OverviewInfoCard title="Version">
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
              </OverviewInfoCard>
            </Box>
          </Stack>

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <OverviewInfoCard title="Health" onClick={() => navigate("/cluster-health")}>
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
                      <Chip
                        size="small"
                        color={nonPassingLocalChecks.length > 0 ? "warning" : "success"}
                        label={`Snapshot checks: ${nonPassingLocalChecks.length} alert${nonPassingLocalChecks.length === 1 ? "" : "s"}`}
                      />
                    </Stack>
                    {nonPassingLocalChecks[0] ? (
                      <Typography variant="body2" color="text.secondary">
                        {nonPassingLocalChecks[0].summary}
                      </Typography>
                    ) : null}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No cluster health available.
                  </Typography>
                )}
              </OverviewInfoCard>
            </Box>

            <Box sx={{ flex: 1 }}>
              <OverviewInfoCard title="Data Streams" onClick={() => navigate("/data-streams")}>
                {renderCount(data?.dataStreamCount ?? null)}
              </OverviewInfoCard>
            </Box>

            <Box sx={{ flex: 1 }}>
              <OverviewInfoCard title="Indices" onClick={() => navigate("/indices")}>
                {renderCount(data?.indexCount ?? null)}
              </OverviewInfoCard>
            </Box>

            <Box sx={{ flex: 1 }}>
              <OverviewInfoCard title="Aliases">
                {renderCount(data?.aliasCount ?? null)}
              </OverviewInfoCard>
            </Box>
          </Stack>

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <OverviewInfoCard title="Docs">
                <Typography variant="h5" component="p">
                  {formatCompactNumber(clusterDocsCount)}
                </Typography>
              </OverviewInfoCard>
            </Box>
            <Box sx={{ flex: 1 }}>
              <OverviewInfoCard title="Store Size">
                <Typography variant="h5" component="p">
                  {formatBytes(clusterStoreBytes, "Unavailable")}
                </Typography>
              </OverviewInfoCard>
            </Box>
            <Box sx={{ flex: 1 }}>
              <OverviewInfoCard title="Total Shards">
                <Typography variant="h5" component="p">
                  {formatCompactNumber(clusterShardCount)}
                </Typography>
              </OverviewInfoCard>
            </Box>
            <Box sx={{ flex: 1 }}>
              <OverviewInfoCard title="Total Indices">
                <Typography variant="h5" component="p">
                  {formatCompactNumber(clusterIndexCount)}
                </Typography>
              </OverviewInfoCard>
            </Box>
          </Stack>

          <OverviewInfoCard title="Node Role Summary">
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
          </OverviewInfoCard>

          <OverviewInfoCard title="Nodes">
            <OverviewNodesTable nodeRows={nodeRows} />
          </OverviewInfoCard>

          {/* Fleet summary */}
          <OverviewInfoCard title="Fleet">
            {data?.fleetStatus ? (
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
                <Typography variant="h5" component="p">
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
          </OverviewInfoCard>
        </Stack>
      )}
    </Box>
  );
}
