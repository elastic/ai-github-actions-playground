import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import MemoryIcon from "@mui/icons-material/Memory";

import {
  NODE_PERMISSION_HEADING,
  NODE_PERMISSION_DESCRIPTION,
} from "../../constants/nodePermissions";
import EmptyState from "../EmptyState";
import { NodeRow } from "./NodeRow";
import type { NodeTableRow } from "./nodeTableHelpers";

export function NodesTable({
  rows,
  loading,
  nodeDataUnavailable,
  onRowClick,
}: {
  rows: NodeTableRow[];
  loading: boolean;
  nodeDataUnavailable: boolean;
  onRowClick: (id: string) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {rows.length === 0 && !loading && !nodeDataUnavailable ? (
        <EmptyState
          icon={<MemoryIcon sx={{ fontSize: 28 }} />}
          heading="No nodes found"
          description="No node metadata is currently available."
        />
      ) : rows.length === 0 && !loading && nodeDataUnavailable ? (
        <EmptyState
          icon={<MemoryIcon sx={{ fontSize: 28 }} />}
          heading={NODE_PERMISSION_HEADING}
          description={NODE_PERMISSION_DESCRIPTION}
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
                  <Tooltip title="Total thread-pool rejections across all pools (cumulative since node start)">
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
              {rows.map((row) => (
                <NodeRow key={row.id} row={row} onClick={() => onRowClick(row.id)} />
              ))}
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
  );
}
