import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import PolicyIcon from "@mui/icons-material/Policy";

import type { IlmIndexRow } from "../services/es/ilmTypes";

import EmptyState from "./EmptyState";
import type { IndexSortField, SortDirection } from "./ilmSortUtils";

const PHASE_COLORS: Record<string, "info" | "success" | "warning" | "error" | "default"> = {
  hot: "error",
  warm: "warning",
  cold: "info",
  frozen: "info",
  delete: "default",
};

interface IlmIndicesTableProps {
  loading: boolean;
  totalCount: number;
  filteredRows: IlmIndexRow[];
  selectedIndex: string | null;
  sortField: IndexSortField;
  sortDir: SortDirection;
  onSort: (field: IndexSortField) => void;
  onSelect: (index: string) => void;
  hasFilters: boolean;
}

export default function IlmIndicesTable({
  loading,
  totalCount,
  filteredRows,
  selectedIndex,
  sortField,
  sortDir,
  onSort,
  onSelect,
  hasFilters,
}: IlmIndicesTableProps) {
  return (
    <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      <TableContainer>
        <Table size="small" stickyHeader aria-label="ILM indices">
          <TableHead>
            <TableRow>
              {(
                [
                  ["index", "Index"],
                  ["policy", "Policy"],
                  ["phase", "Phase"],
                ] as const
              ).map(([field, label]) => (
                <TableCell key={field}>
                  <TableSortLabel
                    active={sortField === field}
                    direction={sortField === field ? sortDir : "asc"}
                    onClick={() => onSort(field)}
                  >
                    {label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell>Action</TableCell>
              {(
                [
                  ["step", "Step"],
                  ["age", "Age"],
                  ["error", "Error"],
                ] as const
              ).map(([field, label]) => (
                <TableCell key={field}>
                  <TableSortLabel
                    active={sortField === field}
                    direction={sortField === field ? sortDir : "asc"}
                    onClick={() => onSort(field)}
                  >
                    {label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && totalCount === 0 && (
              <TableRow>
                <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
                  <LinearProgress />
                </TableCell>
              </TableRow>
            )}
            {filteredRows.map((row) => (
              <TableRow
                key={row.index}
                hover
                selected={row.index === selectedIndex}
                tabIndex={0}
                aria-label={`Open ILM details for ${row.index}`}
                onClick={() => onSelect(row.index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                    event.preventDefault();
                    onSelect(row.index);
                  }
                }}
                sx={{ cursor: "pointer" }}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {row.index}
                  </Typography>
                </TableCell>
                <TableCell>{row.policy}</TableCell>
                <TableCell>
                  <Chip
                    label={row.phase || "\u2014"}
                    size="small"
                    color={PHASE_COLORS[row.phase] ?? "default"}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{row.action || "\u2014"}</TableCell>
                <TableCell>{row.step || "\u2014"}</TableCell>
                <TableCell>{row.age || "\u2014"}</TableCell>
                <TableCell>
                  {row.isError ? (
                    <Chip label="ERROR" size="small" color="error" />
                  ) : (
                    <Chip label="OK" size="small" color="success" variant="outlined" />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} sx={{ border: 0 }}>
                  <EmptyState
                    size="small"
                    icon={<PolicyIcon sx={{ fontSize: 28 }} />}
                    heading="No ILM indices found"
                    description={
                      hasFilters
                        ? "Try adjusting your filters."
                        : "No ILM-managed indices detected."
                    }
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
