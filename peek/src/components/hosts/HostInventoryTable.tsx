import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Chip from "@mui/material/Chip";

import type { HostRow } from "./hostTypes";
import { osLabel, toHostRef } from "./hostTypes";
import type { HostSortDirection } from "./useHostsInventorySearch";
import HostLink from "./HostLink";

interface Column {
  id: string;
  label: string;
  align?: "left" | "right";
}

const COLUMNS: Column[] = [
  { id: "hostName", label: "Host" },
  { id: "osType", label: "OS" },
  { id: "lastSeen", label: "Last Seen" },
  { id: "cpuUtilization", label: "CPU %", align: "right" },
  { id: "memoryUtilization", label: "Memory %", align: "right" },
  { id: "diskUtilization", label: "Disk %", align: "right" },
  { id: "processCount", label: "Processes", align: "right" },
];

function fmtPct(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function fmtCount(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

function fmtTimestamp(value: string): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

interface HostInventoryTableProps {
  hostRows: HostRow[];
  sortField: string;
  sortDirection: HostSortDirection;
  handleSort: (field: string) => void;
  onRowClick?: (row: HostRow) => void;
}

export default function HostInventoryTable({
  hostRows,
  sortField,
  sortDirection,
  handleSort,
  onRowClick,
}: HostInventoryTableProps) {
  return (
    <TableContainer>
      <Table size="small" aria-label="Host inventory">
        <TableHead>
          <TableRow>
            {COLUMNS.map((col) => (
              <TableCell key={col.id} align={col.align ?? "left"}>
                <TableSortLabel
                  active={sortField === col.id}
                  direction={sortField === col.id ? sortDirection : "asc"}
                  onClick={() => handleSort(col.id)}
                >
                  {col.label}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {hostRows.map((row) => (
            <TableRow
              key={row.hostId}
              hover
              sx={{ cursor: onRowClick ? "pointer" : undefined }}
              onClick={() => onRowClick?.(row)}
            >
              <TableCell>
                <HostLink hostRef={toHostRef(row.hostId, row.hostName, row.osType)} />
              </TableCell>
              <TableCell>
                <Chip label={osLabel(row.osType)} size="small" variant="outlined" />
              </TableCell>
              <TableCell>{fmtTimestamp(row.lastSeen)}</TableCell>
              <TableCell align="right">{fmtPct(row.cpuUtilization)}</TableCell>
              <TableCell align="right">{fmtPct(row.memoryUtilization)}</TableCell>
              <TableCell align="right">{fmtPct(row.diskUtilization)}</TableCell>
              <TableCell align="right">{fmtCount(row.processCount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
