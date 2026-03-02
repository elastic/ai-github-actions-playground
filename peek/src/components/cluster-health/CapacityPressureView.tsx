import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import type { ClusterHealthData } from "../../hooks/useClusterHealthData";

import {
  getGcSummary,
  getDiskWatermarks,
  parseNumber,
  percentSeverity,
} from "./clusterHealthUtils";
import InfoCard from "./InfoCard";

interface CapacityPressureViewProps {
  data: ClusterHealthData;
}

export default function CapacityPressureView({ data }: CapacityPressureViewProps) {
  const nodeValues = Object.values(data.nodeStats?.nodes ?? {});
  const watermarks = getDiskWatermarks(data.clusterSettings);

  // CPU
  const avgCpu =
    nodeValues.length > 0
      ? Math.round(
          nodeValues.reduce((s, n) => s + (n.os?.cpu?.percent ?? 0), 0) / nodeValues.length,
        )
      : 0;
  const maxCpu =
    nodeValues.length > 0 ? Math.max(...nodeValues.map((n) => n.os?.cpu?.percent ?? 0)) : 0;

  // Heap
  const avgHeap =
    nodeValues.length > 0
      ? Math.round(
          nodeValues.reduce((s, n) => s + (n.jvm?.mem?.heap_used_percent ?? 0), 0) /
            nodeValues.length,
        )
      : 0;
  const maxHeap =
    nodeValues.length > 0
      ? Math.max(...nodeValues.map((n) => n.jvm?.mem?.heap_used_percent ?? 0))
      : 0;
  const highHeapNodes = nodeValues.filter((n) => (n.jvm?.mem?.heap_used_percent ?? 0) >= 85).length;

  // Disk
  const diskPercents = (data.allocation ?? [])
    .map((e) => parseNumber(e["disk.percent"]))
    .filter((v): v is number => v !== null);
  const avgDisk =
    diskPercents.length > 0
      ? Math.round(diskPercents.reduce((s, v) => s + v, 0) / diskPercents.length)
      : 0;
  const maxDisk = diskPercents.length > 0 ? Math.round(Math.max(...diskPercents)) : 0;
  const highWatermarkNodes = diskPercents.filter((v) => v >= watermarks.high).length;
  const floodStageNodes = diskPercents.filter((v) => v >= watermarks.flood).length;

  // GC
  const gcSummary = getGcSummary(data.nodeStats?.nodes);

  // File descriptors
  const fdNodes = Object.entries(data.nodeStats?.nodes ?? {})
    .map(([id, n]) => ({
      id,
      name: n.name ?? "unknown",
      open: n.process?.open_file_descriptors,
      max: n.process?.max_file_descriptors,
    }))
    .filter((n) => n.open != null && n.max != null);

  return (
    <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ flexWrap: "wrap" }}>
        <InfoCard title="Avg CPU" value={`${avgCpu}%`} severity={percentSeverity(avgCpu, 75, 90)} />
        <InfoCard title="Max CPU" value={`${maxCpu}%`} severity={percentSeverity(maxCpu, 85, 95)} />
        <InfoCard
          title="Avg heap"
          value={`${avgHeap}%`}
          severity={percentSeverity(avgHeap, 75, 90)}
        />
        <InfoCard
          title="Max heap"
          value={`${maxHeap}%`}
          severity={percentSeverity(maxHeap, 85, 95)}
        />
        <InfoCard title="Heap >85%" value={highHeapNodes.toString()} detail="nodes" />
        <InfoCard
          title="Avg disk"
          value={`${avgDisk}%`}
          severity={percentSeverity(avgDisk, watermarks.high, watermarks.flood)}
        />
        <InfoCard
          title="Max disk"
          value={`${maxDisk}%`}
          severity={percentSeverity(maxDisk, watermarks.high, watermarks.flood)}
        />
        <InfoCard
          title="High watermark nodes"
          value={highWatermarkNodes.toString()}
          detail={`>=${watermarks.high}%`}
          severity={highWatermarkNodes > 0 ? "warning" : undefined}
        />
        <InfoCard
          title="Flood-stage nodes"
          value={floodStageNodes.toString()}
          detail={`>=${watermarks.flood}%`}
          severity={floodStageNodes > 0 ? "error" : undefined}
        />
        <InfoCard
          title="Total indices"
          value={(data.clusterStats?.indices?.count ?? 0).toLocaleString()}
        />
      </Stack>

      {gcSummary.length > 0 ? (
        <>
          <Typography variant="body2" sx={{ mt: 3, mb: 1 }}>
            GC Summary
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Node</TableCell>
                  <TableCell align="right">Young GC count</TableCell>
                  <TableCell align="right">Young GC time</TableCell>
                  <TableCell align="right">Old GC count</TableCell>
                  <TableCell align="right">Old GC time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gcSummary.map((gc) => (
                  <TableRow key={gc.nodeName}>
                    <TableCell>{gc.nodeName}</TableCell>
                    <TableCell align="right">{gc.youngCount.toLocaleString()}</TableCell>
                    <TableCell align="right">{(gc.youngTimeMs / 1000).toFixed(1)}s</TableCell>
                    <TableCell align="right">{gc.oldCount.toLocaleString()}</TableCell>
                    <TableCell align="right">{(gc.oldTimeMs / 1000).toFixed(1)}s</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : null}

      {fdNodes.length > 0 ? (
        <>
          <Typography variant="body2" sx={{ mt: 3, mb: 1 }}>
            File Descriptors
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Node</TableCell>
                  <TableCell align="right">Open</TableCell>
                  <TableCell align="right">Max</TableCell>
                  <TableCell align="right">Usage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fdNodes.map((n) => {
                  const pct = n.max! > 0 ? Math.round((n.open! / n.max!) * 100) : 0;
                  return (
                    <TableRow key={n.id}>
                      <TableCell>{n.name}</TableCell>
                      <TableCell align="right">{n.open!.toLocaleString()}</TableCell>
                      <TableCell align="right">{n.max!.toLocaleString()}</TableCell>
                      <TableCell align="right">{pct}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : null}
    </>
  );
}
