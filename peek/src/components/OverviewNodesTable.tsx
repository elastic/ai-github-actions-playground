import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { formatCompactNumber, formatPercent, type NodeRow } from "../utils/clusterOverviewUtils";

import {
  NODE_PERMISSION_HEADING,
  NODE_PERMISSION_DESCRIPTION,
  NODE_STAT_UNAVAILABLE_HINT,
} from "../constants/nodePermissions";
import EmptyState from "./EmptyState";

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

interface OverviewNodesTableProps {
  nodeRows: NodeRow[];
}

export function OverviewNodesTable({ nodeRows }: OverviewNodesTableProps) {
  if (nodeRows.length === 0) {
    return (
      <EmptyState
        size="small"
        heading={NODE_PERMISSION_HEADING}
        description={NODE_PERMISSION_DESCRIPTION}
      />
    );
  }

  return (
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
              <TableCell align="right">{renderNodeStat(formatPercent(row.cpuPercent))}</TableCell>
              <TableCell align="right">{renderNodeStat(formatPercent(row.heapPercent))}</TableCell>
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
  );
}
