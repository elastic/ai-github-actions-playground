import { useMemo } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { buildServiceMapData, type Span } from "../traces/traceUtils";

import { formatLatency, formatErrorRate } from "./serviceInventoryHelpers";
import ServiceMiniDependencyGraph, {
  type DependencyNeighborEdge,
} from "./ServiceMiniDependencyGraph";

interface ServiceDependencyHotspotsPanelProps {
  serviceName: string;
  spans: Span[];
  onPeerServiceClick?: (serviceName: string) => void;
}

export default function ServiceDependencyHotspotsPanel({
  serviceName,
  spans,
  onPeerServiceClick,
}: ServiceDependencyHotspotsPanelProps) {
  const neighbors = useMemo<DependencyNeighborEdge[]>(() => {
    const graph = buildServiceMapData(spans);
    return graph.edges
      .filter((edge) => edge.source === serviceName || edge.target === serviceName)
      .map<DependencyNeighborEdge>((edge) => ({
        direction: edge.source === serviceName ? "outbound" : "inbound",
        peerService: edge.source === serviceName ? edge.target : edge.source,
        calls: edge.callCount,
        errorRate: edge.callCount > 0 ? edge.errorCount / edge.callCount : 0,
        avgLatencyMs: edge.callCount > 0 ? edge.totalDurationUs / edge.callCount / 1000 : 0,
      }))
      .sort(
        (a, b) => b.errorRate - a.errorRate || b.avgLatencyMs - a.avgLatencyMs || b.calls - a.calls,
      )
      .slice(0, 10);
  }, [serviceName, spans]);
  const rows = useMemo(
    () =>
      neighbors.map((neighbor) => ({
        ...neighbor,
        key: `${neighbor.direction}:${neighbor.peerService}`,
      })),
    [neighbors],
  );

  return (
    <Paper variant="outlined" sx={{ minWidth: 0, overflow: "auto" }}>
      <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Dependency Hotspots
        </Typography>
      </Box>
      <Box sx={{ height: 240, minHeight: 180, p: 1, borderBottom: 1, borderColor: "divider" }}>
        <ServiceMiniDependencyGraph
          serviceName={serviceName}
          neighbors={neighbors}
          onPeerServiceClick={onPeerServiceClick}
        />
      </Box>
      <Table size="small" aria-label="Dependency hotspots">
        <TableHead>
          <TableRow>
            <TableCell>Direction</TableCell>
            <TableCell>Service</TableCell>
            <TableCell align="right">Calls</TableCell>
            <TableCell align="right">Avg Latency</TableCell>
            <TableCell align="right">Error Rate</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>
                <Chip
                  size="small"
                  variant="outlined"
                  color={row.direction === "outbound" ? "primary" : "default"}
                  label={row.direction}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" noWrap>
                  {row.peerService}
                </Typography>
              </TableCell>
              <TableCell align="right">{row.calls.toLocaleString()}</TableCell>
              <TableCell align="right">{formatLatency(row.avgLatencyMs)}</TableCell>
              <TableCell align="right">
                <Chip
                  size="small"
                  label={formatErrorRate(row.errorRate)}
                  color={row.errorRate > 0.05 ? "error" : "default"}
                  variant={row.errorRate > 0.05 ? "filled" : "outlined"}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
