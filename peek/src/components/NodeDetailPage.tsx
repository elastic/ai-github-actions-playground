import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
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

import { useClusterOverview } from "../hooks/useClusterOverview";
import { formatBytes } from "../utils/formatBytes";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "n/a";
  if (ms < 1000) return `${ms.toLocaleString()} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatUptime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "n/a";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ── Section components ─────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <Box>
      <Typography variant="subtitle1" color="text.secondary" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Divider sx={{ mb: 1.5 }} />
      {children}
    </Box>
  );
}

interface KVRowProps {
  label: string;
  value: React.ReactNode;
  warn?: boolean;
  critical?: boolean;
}

function KVRow({ label, value, warn, critical }: KVRowProps) {
  return (
    <>
      <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
        {label}
      </Typography>
      <Typography
        component="div"
        variant="body2"
        sx={{
          color: critical ? "error.main" : warn ? "warning.main" : undefined,
          fontWeight: critical || warn ? 600 : undefined,
        }}
      >
        {value}
      </Typography>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

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

    const totalFs = stats?.fs?.total?.total_in_bytes ?? null;
    const availableFs = stats?.fs?.total?.available_in_bytes ?? null;
    const usedFs = totalFs !== null && availableFs !== null ? totalFs - availableFs : null;
    const fsUsedPct =
      totalFs && totalFs > 0 && availableFs !== null
        ? ((totalFs - availableFs) / totalFs) * 100
        : null;

    // Thread pools: sort with non-zero rejected first, then by name
    const threadPools = Object.entries(stats?.thread_pool ?? {})
      .map(([name, p]) => ({
        name,
        active: p.active ?? 0,
        queue: p.queue ?? 0,
        rejected: p.rejected ?? 0,
        completed: p.completed ?? 0,
        threads: p.threads ?? 0,
      }))
      .sort((a, b) => {
        if (b.rejected !== a.rejected) return b.rejected - a.rejected;
        return a.name.localeCompare(b.name);
      });

    const totalRejected = threadPools.reduce((s, p) => s + p.rejected, 0);

    // Circuit breakers
    const breakers = Object.entries(stats?.breakers ?? {})
      .map(([name, b]) => ({
        name,
        limitBytes: b.limit_size_in_bytes ?? null,
        estimatedBytes: b.estimated_size_in_bytes ?? null,
        tripped: b.tripped ?? 0,
      }))
      .sort((a, b) => {
        if (b.tripped !== a.tripped) return b.tripped - a.tripped;
        return a.name.localeCompare(b.name);
      });

    const totalTrips = breakers.reduce((s, b) => s + b.tripped, 0);

    // Ingest pipelines
    const ingestPipelines = Object.entries(stats?.ingest?.pipelines ?? {}).map(([name, p]) => ({
      name,
      count: p.count ?? 0,
      failed: p.failed ?? 0,
      timeMs: p.time_in_millis ?? 0,
    }));

    return {
      id: decodedNodeId,
      name: info?.name ?? stats?.name ?? decodedNodeId,
      version: info?.version ?? "unknown",
      roles: info?.roles ?? [],
      ip: info?.ip ?? null,
      host: info?.host ?? null,
      transportAddress: info?.transport_address ?? null,
      attributes: info?.attributes ?? {},
      osName: info?.os?.name ?? null,
      osVersion: info?.os?.version ?? null,
      availableProcessors: info?.os?.available_processors ?? null,
      jvmVersion: info?.jvm?.version ?? null,
      jvmVendor: info?.jvm?.vm_vendor ?? null,
      configuredHeapBytes: info?.jvm?.mem?.heap_max_in_bytes ?? null,
      // Runtime stats
      osCpuPct: stats?.os?.cpu?.percent ?? null,
      load1m: stats?.os?.cpu?.load_average?.["1m"] ?? null,
      load5m: stats?.os?.cpu?.load_average?.["5m"] ?? null,
      load15m: stats?.os?.cpu?.load_average?.["15m"] ?? null,
      memUsedPct: stats?.os?.mem?.used_percent ?? null,
      memTotalBytes: stats?.os?.mem?.total_in_bytes ?? null,
      memFreeBytes: stats?.os?.mem?.free_in_bytes ?? null,
      processCpuPct: stats?.process?.cpu?.percent ?? null,
      openFds: stats?.process?.open_file_descriptors ?? null,
      maxFds: stats?.process?.max_file_descriptors ?? null,
      jvmUptimeMs: stats?.jvm?.uptime_in_millis ?? null,
      heapPct: stats?.jvm?.mem?.heap_used_percent ?? null,
      heapUsedBytes: stats?.jvm?.mem?.heap_used_in_bytes ?? null,
      heapMaxBytes: stats?.jvm?.mem?.heap_max_in_bytes ?? null,
      heapCommittedBytes: stats?.jvm?.mem?.heap_committed_in_bytes ?? null,
      nonHeapUsedBytes: stats?.jvm?.mem?.non_heap_used_in_bytes ?? null,
      gcYoungCount: stats?.jvm?.gc?.collectors?.young?.collection_count ?? null,
      gcYoungMs: stats?.jvm?.gc?.collectors?.young?.collection_time_in_millis ?? null,
      gcOldCount: stats?.jvm?.gc?.collectors?.old?.collection_count ?? null,
      gcOldMs: stats?.jvm?.gc?.collectors?.old?.collection_time_in_millis ?? null,
      fsTotalBytes: totalFs,
      fsUsedBytes: usedFs,
      fsAvailableBytes: availableFs,
      fsUsedPct,
      transportRxBytes: stats?.transport?.rx_size_in_bytes ?? null,
      transportTxBytes: stats?.transport?.tx_size_in_bytes ?? null,
      transportRxCount: stats?.transport?.rx_count ?? null,
      transportTxCount: stats?.transport?.tx_count ?? null,
      httpCurrentOpen: stats?.http?.current_open ?? null,
      httpTotalOpened: stats?.http?.total_opened ?? null,
      indicesDocs: stats?.indices?.docs?.count ?? null,
      indicesDeleted: stats?.indices?.docs?.deleted ?? null,
      indicesStoreBytes: stats?.indices?.store?.size_in_bytes ?? null,
      indicesShards: stats?.indices?.shard_stats?.total_count ?? null,
      indexingTotal: stats?.indices?.indexing?.index_total ?? null,
      indexingTimeMs: stats?.indices?.indexing?.index_time_in_millis ?? null,
      indexingFailed: stats?.indices?.indexing?.index_failed ?? null,
      searchQueryTotal: stats?.indices?.search?.query_total ?? null,
      searchQueryTimeMs: stats?.indices?.search?.query_time_in_millis ?? null,
      searchFetchTotal: stats?.indices?.search?.fetch_total ?? null,
      searchFetchTimeMs: stats?.indices?.search?.fetch_time_in_millis ?? null,
      mergesTotal: stats?.indices?.merges?.total ?? null,
      mergesTimeMs: stats?.indices?.merges?.total_time_in_millis ?? null,
      segmentCount: stats?.indices?.segments?.count ?? null,
      segmentMemBytes: stats?.indices?.segments?.memory_in_bytes ?? null,
      ingestTotal: stats?.ingest?.total?.count ?? null,
      ingestFailed: stats?.ingest?.total?.failed ?? null,
      ingestTimeMs: stats?.ingest?.total?.time_in_millis ?? null,
      threadPools,
      totalRejected,
      breakers,
      totalTrips,
      ingestPipelines,
    };
  }, [decodedNodeId, data]);

  const kvGridSx = {
    display: "grid",
    gridTemplateColumns: "minmax(180px, auto) 1fr",
    rowGap: 0.75,
    columnGap: 2,
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        height: "100%",
        minHeight: 0,
        overflow: "auto",
      }}
    >
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title={details ? `Node: ${details.name}` : "Node details"}
          description={
            details
              ? `${details.id}${details.transportAddress ? ` · ${details.transportAddress}` : ""}`
              : undefined
          }
          actions={
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={() => navigate("/nodes")}>
                Back to Nodes
              </Button>
              <Button size="small" variant="outlined" onClick={refresh} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh"}
              </Button>
            </Stack>
          }
        />
        {details && (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {details.roles.map((r) => (
              <Chip key={r} label={r} size="small" />
            ))}
            <Chip label={`v${details.version}`} size="small" variant="outlined" />
            {details.heapPct !== null && (
              <Chip
                label={`Heap ${details.heapPct.toFixed(0)}%`}
                size="small"
                color={
                  details.heapPct > 90 ? "error" : details.heapPct > 75 ? "warning" : "default"
                }
              />
            )}
            {details.totalRejected > 0 && (
              <Chip
                label={`${details.totalRejected.toLocaleString()} rejections`}
                size="small"
                color="error"
              />
            )}
            {details.totalTrips > 0 && (
              <Chip
                label={`${details.totalTrips.toLocaleString()} CB trips`}
                size="small"
                color="error"
              />
            )}
          </Stack>
        )}
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pb: 2 }}>
          {/* ── System ── */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Section title="System">
              <Box sx={kvGridSx}>
                <KVRow
                  label="OS CPU"
                  value={details.osCpuPct === null ? "n/a" : `${details.osCpuPct.toFixed(0)}%`}
                  warn={details.osCpuPct !== null && details.osCpuPct > 70}
                  critical={details.osCpuPct !== null && details.osCpuPct > 90}
                />
                <KVRow
                  label="Process CPU"
                  value={
                    details.processCpuPct === null ? "n/a" : `${details.processCpuPct.toFixed(0)}%`
                  }
                />
                <KVRow
                  label="Load average (1 / 5 / 15 min)"
                  value={
                    details.load1m === null
                      ? "n/a"
                      : `${details.load1m.toFixed(2)} / ${details.load5m === null ? "n/a" : details.load5m.toFixed(2)} / ${details.load15m === null ? "n/a" : details.load15m.toFixed(2)}`
                  }
                  warn={details.load1m !== null && details.load1m > 5}
                />
                <KVRow
                  label="Memory used"
                  value={
                    details.memUsedPct !== null
                      ? `${details.memUsedPct.toFixed(0)}%${details.memTotalBytes ? ` (${formatBytes(details.memTotalBytes)} total)` : ""}`
                      : "n/a"
                  }
                  warn={details.memUsedPct !== null && details.memUsedPct > 80}
                />
                <KVRow
                  label="File descriptors"
                  value={
                    details.openFds !== null && details.maxFds !== null
                      ? `${details.openFds.toLocaleString()} / ${details.maxFds.toLocaleString()}${details.maxFds > 0 ? ` (${((details.openFds / details.maxFds) * 100).toFixed(0)}%)` : ""}`
                      : "n/a"
                  }
                />
                <KVRow label="JVM uptime" value={formatUptime(details.jvmUptimeMs)} />
              </Box>
            </Section>
          </Paper>

          {/* ── JVM ── */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Section title="JVM">
              <Box sx={kvGridSx}>
                <KVRow
                  label="Heap used"
                  value={
                    details.heapPct !== null
                      ? `${details.heapPct.toFixed(0)}%${details.heapUsedBytes !== null && details.heapMaxBytes !== null ? ` (${formatBytes(details.heapUsedBytes)} / ${formatBytes(details.heapMaxBytes)})` : ""}`
                      : "n/a"
                  }
                  warn={details.heapPct !== null && details.heapPct > 75}
                  critical={details.heapPct !== null && details.heapPct > 90}
                />
                <KVRow label="Heap committed" value={formatBytes(details.heapCommittedBytes)} />
                <KVRow label="Non-heap used" value={formatBytes(details.nonHeapUsedBytes)} />
                {details.configuredHeapBytes !== null && (
                  <KVRow
                    label="Configured heap max (-Xmx)"
                    value={formatBytes(details.configuredHeapBytes)}
                  />
                )}
                <KVRow
                  label="GC young gen"
                  value={
                    details.gcYoungCount === null
                      ? "n/a"
                      : `${details.gcYoungCount.toLocaleString()} collections · ${formatMs(details.gcYoungMs)}`
                  }
                />
                <KVRow
                  label="GC old gen"
                  value={
                    details.gcOldCount === null
                      ? "n/a"
                      : `${details.gcOldCount.toLocaleString()} collections · ${formatMs(details.gcOldMs)}`
                  }
                  warn={details.gcOldMs !== null && details.gcOldMs > 10_000}
                  critical={details.gcOldMs !== null && details.gcOldMs > 60_000}
                />
                {details.jvmVersion && <KVRow label="JVM version" value={details.jvmVersion} />}
                {details.jvmVendor && <KVRow label="JVM vendor" value={details.jvmVendor} />}
              </Box>
            </Section>
          </Paper>

          {/* ── Disk ── */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Section title="Disk">
              <Box sx={kvGridSx}>
                <KVRow
                  label="Used / total"
                  value={
                    details.fsUsedBytes !== null && details.fsTotalBytes !== null
                      ? `${formatBytes(details.fsUsedBytes)} / ${formatBytes(details.fsTotalBytes)}${details.fsUsedPct !== null ? ` (${details.fsUsedPct.toFixed(0)}%)` : ""}`
                      : "n/a"
                  }
                  warn={details.fsUsedPct !== null && details.fsUsedPct > 85}
                  critical={details.fsUsedPct !== null && details.fsUsedPct > 95}
                />
                <KVRow label="Available" value={formatBytes(details.fsAvailableBytes)} />
              </Box>
            </Section>
          </Paper>

          {/* ── Indices ── */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Section title="Indices">
              <Box sx={kvGridSx}>
                <KVRow
                  label="Documents"
                  value={
                    details.indicesDocs !== null
                      ? `${details.indicesDocs.toLocaleString()}${details.indicesDeleted ? ` (${details.indicesDeleted.toLocaleString()} deleted)` : ""}`
                      : "n/a"
                  }
                />
                <KVRow
                  label="Shards"
                  value={
                    details.indicesShards !== null ? details.indicesShards.toLocaleString() : "n/a"
                  }
                />
                <KVRow label="Store size" value={formatBytes(details.indicesStoreBytes)} />
                <KVRow
                  label="Segments"
                  value={
                    details.segmentCount !== null
                      ? `${details.segmentCount.toLocaleString()}${details.segmentMemBytes !== null ? ` · ${formatBytes(details.segmentMemBytes)} mem` : ""}`
                      : "n/a"
                  }
                />
                <KVRow
                  label="Indexing ops"
                  value={
                    details.indexingTotal !== null
                      ? `${details.indexingTotal.toLocaleString()} (${formatMs(details.indexingTimeMs)})${details.indexingFailed ? ` · ${details.indexingFailed.toLocaleString()} failed` : ""}`
                      : "n/a"
                  }
                  warn={!!details.indexingFailed && details.indexingFailed > 0}
                />
                <KVRow
                  label="Search queries"
                  value={
                    details.searchQueryTotal !== null
                      ? `${details.searchQueryTotal.toLocaleString()} (${formatMs(details.searchQueryTimeMs)})`
                      : "n/a"
                  }
                />
                <KVRow
                  label="Search fetches"
                  value={
                    details.searchFetchTotal !== null
                      ? `${details.searchFetchTotal.toLocaleString()} (${formatMs(details.searchFetchTimeMs)})`
                      : "n/a"
                  }
                />
                <KVRow
                  label="Merges"
                  value={
                    details.mergesTotal !== null
                      ? `${details.mergesTotal.toLocaleString()} (${formatMs(details.mergesTimeMs)})`
                      : "n/a"
                  }
                />
              </Box>
            </Section>
          </Paper>

          {/* ── Thread Pools ── */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Section title="Thread Pools">
              {details.totalRejected > 0 && (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                  {details.totalRejected.toLocaleString()} total rejection(s) detected. Rejections
                  indicate thread pool saturation and requests being dropped.
                </Alert>
              )}
              {details.threadPools.length === 0 ? (
                <EmptyState
                  heading="No thread pool data"
                  description="Thread pool statistics are not available for this node."
                />
              ) : (
                <TableContainer>
                  <Table size="small" aria-label="Thread pools">
                    <TableHead>
                      <TableRow>
                        <TableCell>Pool</TableCell>
                        <TableCell align="right">Threads</TableCell>
                        <TableCell align="right">Active</TableCell>
                        <TableCell align="right">Queue</TableCell>
                        <TableCell align="right">Rejected</TableCell>
                        <TableCell align="right">Completed</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {details.threadPools.map((p) => (
                        <TableRow key={p.name}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell align="right">{p.threads.toLocaleString()}</TableCell>
                          <TableCell align="right">{p.active.toLocaleString()}</TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: p.queue > 0 ? "warning.main" : undefined }}
                          >
                            {p.queue.toLocaleString()}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              color: p.rejected > 0 ? "error.main" : undefined,
                              fontWeight: p.rejected > 0 ? 700 : undefined,
                            }}
                          >
                            {p.rejected.toLocaleString()}
                          </TableCell>
                          <TableCell align="right">{p.completed.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Section>
          </Paper>

          {/* ── Circuit Breakers ── */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Section title="Circuit Breakers">
              {details.totalTrips > 0 && (
                <Alert severity="error" sx={{ mb: 1.5 }}>
                  {details.totalTrips.toLocaleString()} circuit-breaker trip(s) detected. Trips
                  indicate memory pressure; further requests may fail with 429 errors.
                </Alert>
              )}
              {details.breakers.length === 0 ? (
                <EmptyState
                  heading="No circuit-breaker data"
                  description="Circuit-breaker statistics are not available for this node."
                />
              ) : (
                <TableContainer>
                  <Table size="small" aria-label="Circuit breakers">
                    <TableHead>
                      <TableRow>
                        <TableCell>Breaker</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Configured memory limit for this breaker">
                            <span>Limit</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Current estimated usage">
                            <span>Estimated</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Number of times this breaker has tripped">
                            <span>Trips</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Estimated usage as percent of limit">
                            <span>Usage %</span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {details.breakers.map((b) => {
                        const usagePct =
                          b.limitBytes && b.limitBytes > 0 && b.estimatedBytes !== null
                            ? (b.estimatedBytes / b.limitBytes) * 100
                            : null;
                        return (
                          <TableRow key={b.name}>
                            <TableCell>{b.name}</TableCell>
                            <TableCell align="right">{formatBytes(b.limitBytes)}</TableCell>
                            <TableCell align="right">{formatBytes(b.estimatedBytes)}</TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                color: b.tripped > 0 ? "error.main" : undefined,
                                fontWeight: b.tripped > 0 ? 700 : undefined,
                              }}
                            >
                              {b.tripped.toLocaleString()}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                color:
                                  usagePct !== null && usagePct > 90
                                    ? "error.main"
                                    : usagePct !== null && usagePct > 75
                                      ? "warning.main"
                                      : undefined,
                              }}
                            >
                              {usagePct !== null ? `${usagePct.toFixed(0)}%` : "n/a"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Section>
          </Paper>

          {/* ── Network ── */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Section title="Network">
              <Box sx={kvGridSx}>
                <KVRow
                  label="Transport RX"
                  value={
                    details.transportRxBytes !== null
                      ? `${formatBytes(details.transportRxBytes)} (${(details.transportRxCount ?? 0).toLocaleString()} msgs)`
                      : "n/a"
                  }
                />
                <KVRow
                  label="Transport TX"
                  value={
                    details.transportTxBytes !== null
                      ? `${formatBytes(details.transportTxBytes)} (${(details.transportTxCount ?? 0).toLocaleString()} msgs)`
                      : "n/a"
                  }
                />
                <KVRow
                  label="HTTP open connections"
                  value={
                    details.httpCurrentOpen !== null
                      ? `${details.httpCurrentOpen.toLocaleString()} current / ${(details.httpTotalOpened ?? 0).toLocaleString()} total opened`
                      : "n/a"
                  }
                />
              </Box>
            </Section>
          </Paper>

          {/* ── Ingest ── */}
          {(details.ingestTotal !== null || details.ingestPipelines.length > 0) && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Section title="Ingest">
                <Box sx={{ ...kvGridSx, mb: details.ingestPipelines.length > 0 ? 2 : 0 }}>
                  <KVRow
                    label="Total docs ingested"
                    value={
                      details.ingestTotal !== null ? details.ingestTotal.toLocaleString() : "n/a"
                    }
                  />
                  <KVRow
                    label="Total failed"
                    value={
                      details.ingestFailed !== null ? details.ingestFailed.toLocaleString() : "n/a"
                    }
                    warn={!!details.ingestFailed && details.ingestFailed > 0}
                  />
                  <KVRow label="Total time" value={formatMs(details.ingestTimeMs)} />
                </Box>
                {details.ingestPipelines.length > 0 && (
                  <TableContainer>
                    <Table size="small" aria-label="Ingest pipelines">
                      <TableHead>
                        <TableRow>
                          <TableCell>Pipeline</TableCell>
                          <TableCell align="right">Docs</TableCell>
                          <TableCell align="right">Failed</TableCell>
                          <TableCell align="right">Time</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {details.ingestPipelines.map((p) => (
                          <TableRow key={p.name}>
                            <TableCell>{p.name}</TableCell>
                            <TableCell align="right">{p.count.toLocaleString()}</TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                color: p.failed > 0 ? "warning.main" : undefined,
                                fontWeight: p.failed > 0 ? 600 : undefined,
                              }}
                            >
                              {p.failed.toLocaleString()}
                            </TableCell>
                            <TableCell align="right">{formatMs(p.timeMs)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Section>
            </Paper>
          )}

          {/* ── Node Info ── */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Section title="Node Info">
              <Box sx={kvGridSx}>
                <KVRow label="Node ID" value={details.id} />
                {details.ip && <KVRow label="IP" value={details.ip} />}
                {details.host && <KVRow label="Host" value={details.host} />}
                {details.transportAddress && (
                  <KVRow label="Transport address" value={details.transportAddress} />
                )}
                {details.osName && (
                  <KVRow
                    label="Operating system"
                    value={`${details.osName}${details.osVersion ? ` ${details.osVersion}` : ""}`}
                  />
                )}
                {details.availableProcessors !== null && (
                  <KVRow label="Processors" value={details.availableProcessors.toLocaleString()} />
                )}
                {Object.keys(details.attributes).length > 0 && (
                  <KVRow
                    label="Attributes"
                    value={
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {Object.entries(details.attributes).map(([k, v]) => (
                          <Chip key={k} label={`${k}=${v}`} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    }
                  />
                )}
              </Box>
            </Section>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
