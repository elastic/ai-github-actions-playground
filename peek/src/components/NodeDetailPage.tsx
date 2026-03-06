import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { useClusterOverview } from "../hooks/useClusterOverview";
import { formatBytes } from "../utils/formatBytes";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";

export default function NodeDetailPage() {
  const navigate = useNavigate();
  const { nodeId } = useParams<{ nodeId: string }>();
  const decodedNodeId = nodeId ? decodeURIComponent(nodeId) : null;
  const { result, partialErrors, refresh } = useClusterOverview();

  const data = result.status === "success" ? result.data : null;
  const loading = result.status === "loading";
  const error = result.status === "error" ? result.error : null;
  const nodeDataUnavailable =
    partialErrors.includes("nodes") && partialErrors.includes("node stats");

  const details = useMemo(() => {
    if (!decodedNodeId || !data) return null;
    const info = data.nodesInfo?.nodes?.[decodedNodeId];
    const stats = data.nodesStats?.nodes?.[decodedNodeId];
    if (!info && !stats) return null;

    const totalFs = stats?.fs?.total?.total_in_bytes;
    const availableFs = stats?.fs?.total?.available_in_bytes;
    const usedFs = totalFs && availableFs !== undefined ? totalFs - availableFs : null;

    return {
      id: decodedNodeId,
      name: info?.name ?? stats?.name ?? decodedNodeId,
      version: info?.version ?? "unknown",
      roles: info?.roles ?? [],
      cpu: stats?.os?.cpu?.percent ?? null,
      heap: stats?.jvm?.mem?.heap_used_percent ?? null,
      memUsedPercent: stats?.os?.mem?.used_percent ?? null,
      memTotalBytes: stats?.os?.mem?.total_in_bytes ?? null,
      fsTotalBytes: totalFs ?? null,
      fsUsedBytes: usedFs ?? null,
      docs: stats?.indices?.docs?.count ?? null,
      shards: stats?.indices?.shard_stats?.total_count ?? null,
      indexingTotal: stats?.indices?.indexing?.index_total ?? null,
      searchTotal: stats?.indices?.search?.query_total ?? null,
      openFds: stats?.process?.open_file_descriptors ?? null,
      maxFds: stats?.process?.max_file_descriptors ?? null,
    };
  }, [decodedNodeId, data]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title={details ? `Node: ${details.name}` : "Node details"}
          description={details ? details.id : undefined}
          actions={
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={() => navigate("/nodes")}>
                Back to Nodes
              </Button>
              <Button size="small" variant="outlined" onClick={refresh}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </Stack>
          }
        />
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {!error && partialErrors.length > 0 && (
        <Alert severity="warning">
          Partial data loaded. Unavailable: {partialErrors.join(", ")}.
        </Alert>
      )}

      {error ? null : !details ? (
        <EmptyState
          heading={nodeDataUnavailable ? "Node data unavailable" : "Node not found"}
          description={
            nodeDataUnavailable
              ? "Node APIs are unavailable for this cluster or current permissions."
              : "The selected node could not be found in current cluster node data."
          }
        />
      ) : (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            <Chip size="small" label={`Version: ${details.version}`} />
            <Chip
              size="small"
              label={`CPU: ${details.cpu === null ? "n/a" : `${details.cpu.toFixed(0)}%`}`}
            />
            <Chip
              size="small"
              label={`Heap: ${details.heap === null ? "n/a" : `${details.heap.toFixed(0)}%`}`}
            />
            <Chip
              size="small"
              label={`Mem: ${details.memUsedPercent === null ? "n/a" : `${details.memUsedPercent.toFixed(0)}%`}`}
            />
          </Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(200px, auto) 1fr",
              rowGap: 0.75,
              columnGap: 1.5,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Roles
            </Typography>
            <Typography variant="body2">
              {details.roles.length > 0 ? details.roles.join(", ") : "n/a"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Documents
            </Typography>
            <Typography variant="body2">
              {details.docs === null ? "n/a" : details.docs.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Shards
            </Typography>
            <Typography variant="body2">
              {details.shards === null ? "n/a" : details.shards.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Indexing ops
            </Typography>
            <Typography variant="body2">
              {details.indexingTotal === null ? "n/a" : details.indexingTotal.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Search ops
            </Typography>
            <Typography variant="body2">
              {details.searchTotal === null ? "n/a" : details.searchTotal.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Memory total
            </Typography>
            <Typography variant="body2">{formatBytes(details.memTotalBytes)}</Typography>
            <Typography variant="caption" color="text.secondary">
              Disk total
            </Typography>
            <Typography variant="body2">{formatBytes(details.fsTotalBytes)}</Typography>
            <Typography variant="caption" color="text.secondary">
              Disk used
            </Typography>
            <Typography variant="body2">{formatBytes(details.fsUsedBytes)}</Typography>
            <Typography variant="caption" color="text.secondary">
              File descriptors
            </Typography>
            <Typography variant="body2">
              {details.openFds === null || details.maxFds === null
                ? "n/a"
                : `${details.openFds.toLocaleString()} / ${details.maxFds.toLocaleString()}`}
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
