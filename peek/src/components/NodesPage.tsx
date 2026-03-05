import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import MemoryIcon from "@mui/icons-material/Memory";

import { useClusterOverview } from "../hooks/useClusterOverview";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";

interface NodeDetailRow {
  id: string;
  name: string;
  roles: string[];
  version: string;
  cpuPercent: number | null;
  heapPercent: number | null;
  memUsedPercent: number | null;
  fsUsedPercent: number | null;
  docCount: number | null;
  shardCount: number | null;
  openFds: number | null;
  maxFds: number | null;
}

export default function NodesPage() {
  const navigate = useNavigate();
  const { result, partialErrors, refresh } = useClusterOverview();
  const loading = result.status === "loading";
  const error = result.status === "error" ? result.error : null;
  const data = result.status === "success" ? result.data : null;

  const rows = useMemo<NodeDetailRow[]>(() => {
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
      return {
        id,
        name: info?.name ?? stats?.name ?? id,
        roles: info?.roles ?? [],
        version: info?.version ?? "unknown",
        cpuPercent: stats?.os?.cpu?.percent ?? null,
        heapPercent: stats?.jvm?.mem?.heap_used_percent ?? null,
        memUsedPercent: stats?.os?.mem?.used_percent ?? null,
        fsUsedPercent,
        docCount: stats?.indices?.docs?.count ?? null,
        shardCount: stats?.indices?.shard_stats?.total_count ?? null,
        openFds: stats?.process?.open_file_descriptors ?? null,
        maxFds: stats?.process?.max_file_descriptors ?? null,
      };
    });
  }, [data?.nodesInfo?.nodes, data?.nodesStats?.nodes]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Nodes"
          description="Detailed runtime and capacity view of Elasticsearch nodes."
          actions={
            <Button
              size="small"
              variant="outlined"
              onClick={refresh}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={14} aria-hidden="true" /> : undefined}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
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
          {rows.length === 0 && !loading && partialErrors.length === 0 ? (
            <EmptyState
              icon={<MemoryIcon sx={{ fontSize: 28 }} />}
              heading={
                partialErrors.includes("nodes") && partialErrors.includes("node stats")
                  ? "Node data unavailable"
                  : "No nodes found"
              }
              description={
                partialErrors.includes("nodes") && partialErrors.includes("node stats")
                  ? "Node APIs are unavailable for this cluster or current permissions."
                  : "No node metadata is currently available."
              }
            />
          ) : (
            <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <Table size="small" stickyHeader aria-label="Nodes table">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Roles</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell align="right">CPU</TableCell>
                    <TableCell align="right">Heap</TableCell>
                    <TableCell align="right">Memory</TableCell>
                    <TableCell align="right">Disk</TableCell>
                    <TableCell align="right">Docs</TableCell>
                    <TableCell align="right">Shards</TableCell>
                    <TableCell align="right">FDs</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      hover
                      tabIndex={0}
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
                      <TableCell>
                        <Typography variant="body2" noWrap title={`${row.name} (${row.id})`}>
                          {row.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {row.roles.length > 0 ? row.roles.join(", ") : "n/a"}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.version}</TableCell>
                      <TableCell align="right">
                        {row.cpuPercent === null ? "n/a" : `${row.cpuPercent.toFixed(0)}%`}
                      </TableCell>
                      <TableCell align="right">
                        {row.heapPercent === null ? "n/a" : `${row.heapPercent.toFixed(0)}%`}
                      </TableCell>
                      <TableCell align="right">
                        {row.memUsedPercent === null ? "n/a" : `${row.memUsedPercent.toFixed(0)}%`}
                      </TableCell>
                      <TableCell align="right">
                        {row.fsUsedPercent === null ? "n/a" : `${row.fsUsedPercent.toFixed(0)}%`}
                      </TableCell>
                      <TableCell align="right">
                        {row.docCount === null ? "n/a" : row.docCount.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        {row.shardCount === null ? "n/a" : row.shardCount.toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        {row.openFds === null || row.maxFds === null
                          ? "n/a"
                          : `${row.openFds.toLocaleString()} / ${row.maxFds.toLocaleString()}`}
                      </TableCell>
                    </TableRow>
                  ))}
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={10}>
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
