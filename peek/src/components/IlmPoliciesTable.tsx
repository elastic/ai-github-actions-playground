import Box from "@mui/material/Box";
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

import type { IlmPolicyRow } from "../services/es/ilmTypes";

import EmptyState from "./EmptyState";
import type { PolicySortField, SortDirection } from "./ilmSortUtils";

const PHASE_COLORS: Record<string, "info" | "success" | "warning" | "error" | "default"> = {
  hot: "error",
  warm: "warning",
  cold: "info",
  frozen: "info",
  delete: "default",
};

interface IlmPoliciesTableProps {
  loading: boolean;
  totalCount: number;
  filteredRows: IlmPolicyRow[];
  selectedPolicy: IlmPolicyRow | null;
  sortField: PolicySortField;
  sortDir: SortDirection;
  onSort: (field: PolicySortField) => void;
  onSelect: (row: IlmPolicyRow) => void;
  search: string;
}

export default function IlmPoliciesTable({
  loading,
  totalCount,
  filteredRows,
  selectedPolicy,
  sortField,
  sortDir,
  onSort,
  onSelect,
  search,
}: IlmPoliciesTableProps) {
  return (
    <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      <TableContainer>
        <Table size="small" stickyHeader aria-label="ILM policies">
          <TableHead>
            <TableRow>
              {(
                [
                  ["name", "Policy"],
                  ["version", "Version"],
                  ["modifiedDate", "Modified"],
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
              <TableCell>Phases</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "indexCount"}
                  direction={sortField === "indexCount" ? sortDir : "asc"}
                  onClick={() => onSort("indexCount")}
                >
                  In Use By
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && totalCount === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ py: 0, border: 0 }}>
                  <LinearProgress />
                </TableCell>
              </TableRow>
            )}
            {filteredRows.map((row) => (
              <TableRow
                key={row.name}
                hover
                selected={row.name === selectedPolicy?.name}
                tabIndex={0}
                aria-label={`Open policy details for ${row.name}`}
                onClick={() => onSelect(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                    event.preventDefault();
                    onSelect(row);
                  }
                }}
                sx={{ cursor: "pointer" }}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {row.name}
                  </Typography>
                </TableCell>
                <TableCell>{row.version}</TableCell>
                <TableCell>{row.modifiedDate || "\u2014"}</TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {row.phases.map((p) => (
                      <Chip
                        key={p}
                        label={p}
                        size="small"
                        color={PHASE_COLORS[p] ?? "default"}
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  {row.indexCount} indices, {row.dataStreamCount} data streams, {row.templateCount}{" "}
                  templates
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ border: 0 }}>
                  <EmptyState
                    size="small"
                    icon={<PolicyIcon sx={{ fontSize: 28 }} />}
                    heading="No ILM policies found"
                    description={
                      search ? "Try adjusting your search." : "No ILM policies configured."
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
