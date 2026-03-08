import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import BackupIcon from "@mui/icons-material/Backup";

import type { RepositoryRow } from "../../hooks/useSnapshotData";
import { COMPONENT_HEIGHTS, COMPACT_CHIP_SX } from "../../types/tokens";
import EmptyState from "../EmptyState";
import type { RepositorySortField, SortDirection } from "../snapshotSortUtils";

import { summarizeSettings } from "./snapshotFormatters";

interface RepositoriesTableProps {
  loading: boolean;
  rows: RepositoryRow[];
  totalCount: number;
  sortField: RepositorySortField;
  sortDir: SortDirection;
  onSort: (field: RepositorySortField) => void;
}

export default function RepositoriesTable({
  loading,
  rows,
  totalCount,
  sortField,
  sortDir,
  onSort,
}: RepositoriesTableProps) {
  if (!loading && totalCount === 0) {
    return (
      <EmptyState
        icon={<BackupIcon sx={{ fontSize: 40 }} />}
        heading="No repositories"
        description="No snapshot repositories are configured."
      />
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
      <Table size="small" stickyHeader aria-label="Repositories table">
        <TableHead>
          <TableRow>
            <TableCell sx={{ height: COMPONENT_HEIGHTS.tableRow }}>
              <TableSortLabel
                active={sortField === "name"}
                direction={sortField === "name" ? sortDir : "asc"}
                onClick={() => onSort("name")}
              >
                Repository
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ height: COMPONENT_HEIGHTS.tableRow }}>
              <TableSortLabel
                active={sortField === "type"}
                direction={sortField === "type" ? sortDir : "asc"}
                onClick={() => onSort("type")}
              >
                Type
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ height: COMPONENT_HEIGHTS.tableRow }}>Settings</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name} hover>
              <TableCell>
                <Typography variant="body2" noWrap>
                  {row.name}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip label={row.type} size="small" sx={COMPACT_CHIP_SX} />
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 400 }}>
                  {summarizeSettings(row.settings)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
          {!loading && rows.length === 0 && totalCount > 0 && (
            <TableRow>
              <TableCell colSpan={3}>
                <EmptyState
                  size="small"
                  heading="No matching repositories"
                  description="No repositories match the current filter."
                />
              </TableCell>
            </TableRow>
          )}
          {loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2, textAlign: "center" }}
                >
                  Loading repositories…
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
