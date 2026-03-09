import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import BackupIcon from "@mui/icons-material/Backup";
import { Link as RouterLink } from "react-router-dom";

import type { SnapshotRow } from "../../hooks/useSnapshotData";
import { COMPONENT_HEIGHTS, COMPACT_CHIP_SX } from "../../types/tokens";
import EmptyState from "../EmptyState";
import type { SnapshotSortField, SortDirection } from "../snapshotSortUtils";

import { stateColor, formatRelativeTime, formatDuration } from "./snapshotFormatters";

interface SnapshotsTableProps {
  loading: boolean;
  rows: SnapshotRow[];
  totalCount: number;
  sortField: SnapshotSortField;
  sortDir: SortDirection;
  onSort: (field: SnapshotSortField) => void;
}

export default function SnapshotsTable({
  loading,
  rows,
  totalCount,
  sortField,
  sortDir,
  onSort,
}: SnapshotsTableProps) {
  if (!loading && totalCount === 0) {
    return (
      <EmptyState
        icon={<BackupIcon sx={{ fontSize: 40 }} />}
        heading="No snapshots found"
        description="No snapshot repositories are configured, or no snapshots have been taken yet."
        action={
          <Button
            component={RouterLink}
            to="/docs?section=snapshots"
            variant="outlined"
            size="small"
          >
            View setup docs
          </Button>
        }
      />
    );
  }

  const columns: Array<{ field: SnapshotSortField; label: string }> = [
    { field: "state", label: "State" },
    { field: "name", label: "Snapshot" },
    { field: "repository", label: "Repository" },
    { field: "indexCount", label: "Indices" },
    { field: "startTime", label: "Started" },
    { field: "duration", label: "Duration" },
  ];

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
      <Table size="small" stickyHeader aria-label="Snapshots table">
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.field} sx={{ height: COMPONENT_HEIGHTS.tableRow }}>
                <TableSortLabel
                  active={sortField === col.field}
                  direction={sortField === col.field ? sortDir : "asc"}
                  onClick={() => onSort(col.field)}
                >
                  {col.label}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.repository}/${row.name}`} hover>
              <TableCell>
                <Chip
                  label={row.state}
                  color={stateColor(row.state)}
                  size="small"
                  sx={COMPACT_CHIP_SX}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" noWrap>
                  {row.name}
                </Typography>
              </TableCell>
              <TableCell>{row.repository}</TableCell>
              <TableCell>{row.indexCount}</TableCell>
              <TableCell>
                <Tooltip title={row.startTime}>
                  <span>{formatRelativeTime(row.startTimeMs)}</span>
                </Tooltip>
              </TableCell>
              <TableCell>{formatDuration(row.duration)}</TableCell>
            </TableRow>
          ))}
          {!loading && rows.length === 0 && totalCount > 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState
                  size="small"
                  heading="No matching snapshots"
                  description="No snapshots match the current filter."
                />
              </TableCell>
            </TableRow>
          )}
          {loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2, textAlign: "center" }}
                >
                  Loading snapshots…
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
