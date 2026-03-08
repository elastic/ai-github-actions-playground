import Box from "@mui/material/Box";
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

import type { SlmPolicyRow } from "../../hooks/useSnapshotData";
import { COMPONENT_HEIGHTS, COMPACT_CHIP_SX } from "../../types/tokens";
import EmptyState from "../EmptyState";
import type { PolicySortField, SortDirection } from "../snapshotSortUtils";

import { formatRelativeTime } from "./snapshotFormatters";

interface PoliciesTableProps {
  loading: boolean;
  rows: SlmPolicyRow[];
  totalCount: number;
  sortField: PolicySortField;
  sortDir: SortDirection;
  onSort: (field: PolicySortField) => void;
}

export default function PoliciesTable({
  loading,
  rows,
  totalCount,
  sortField,
  sortDir,
  onSort,
}: PoliciesTableProps) {
  if (!loading && totalCount === 0) {
    return (
      <EmptyState
        icon={<BackupIcon sx={{ fontSize: 40 }} />}
        heading="No SLM policies"
        description="No Snapshot Lifecycle Management policies are configured."
      />
    );
  }

  const columns: Array<{ field: PolicySortField; label: string; sortable: boolean }> = [
    { field: "name", label: "Policy", sortable: true },
    { field: "repository", label: "Repository", sortable: true },
    { field: "nextRun", label: "Next Run", sortable: true },
    { field: "taken", label: "Taken / Failed", sortable: true },
    { field: "lastSuccess", label: "Last Success", sortable: true },
    { field: "lastFailure", label: "Last Failure", sortable: true },
  ];

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
      <Table size="small" stickyHeader aria-label="SLM Policies table">
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.field} sx={{ height: COMPONENT_HEIGHTS.tableRow }}>
                {col.sortable ? (
                  <TableSortLabel
                    active={sortField === col.field}
                    direction={sortField === col.field ? sortDir : "asc"}
                    onClick={() => onSort(col.field)}
                  >
                    {col.label}
                  </TableSortLabel>
                ) : (
                  col.label
                )}
              </TableCell>
            ))}
            <TableCell sx={{ height: COMPONENT_HEIGHTS.tableRow }}>Schedule</TableCell>
            <TableCell sx={{ height: COMPONENT_HEIGHTS.tableRow }}>Retention</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name} hover>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="body2" noWrap>
                    {row.name}
                  </Typography>
                  {row.isFailing && (
                    <Chip label="FAILING" color="error" size="small" sx={COMPACT_CHIP_SX} />
                  )}
                </Box>
              </TableCell>
              <TableCell>{row.repository}</TableCell>
              <TableCell>{formatRelativeTime(row.nextExecutionMs)}</TableCell>
              <TableCell>
                {row.snapshotsTaken} /{" "}
                <Typography
                  component="span"
                  variant="body2"
                  color={row.snapshotsFailed > 0 ? "error.main" : "text.primary"}
                >
                  {row.snapshotsFailed}
                </Typography>
              </TableCell>
              <TableCell>{formatRelativeTime(row.lastSuccessTime)}</TableCell>
              <TableCell>
                {row.lastFailureTime ? (
                  <Tooltip title={row.lastFailureDetails || "No details"}>
                    <Typography variant="body2" color="error.main" noWrap sx={{ maxWidth: 200 }}>
                      {formatRelativeTime(row.lastFailureTime)}
                    </Typography>
                  </Tooltip>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {row.schedule || "—"}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {(() => {
                    const parts = [
                      row.expireAfter || null,
                      row.minCount != null ? `min ${row.minCount}` : null,
                      row.maxCount != null ? `max ${row.maxCount}` : null,
                    ].filter(Boolean);
                    return parts.length > 0 ? parts.join(", ") : "—";
                  })()}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
          {!loading && rows.length === 0 && totalCount > 0 && (
            <TableRow>
              <TableCell colSpan={8}>
                <EmptyState
                  size="small"
                  heading="No matching policies"
                  description="No policies match the current filter."
                />
              </TableCell>
            </TableRow>
          )}
          {loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2, textAlign: "center" }}
                >
                  Loading policies…
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
