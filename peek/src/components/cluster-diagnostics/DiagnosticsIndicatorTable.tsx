import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";

import EmptyState from "../EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IndicatorStatus = "green" | "yellow" | "red" | "unknown";

export type SortField = "status" | "name" | "impactsCount" | "diagnosesCount" | "worstSeverity";

export interface IndicatorRow {
  key: string;
  name: string;
  status: IndicatorStatus;
  symptom: string;
  impactsCount: number;
  diagnosesCount: number;
  worstSeverity: number;
}

function indicatorStatusColor(
  status: IndicatorStatus | undefined,
): "success" | "warning" | "error" | "default" {
  if (status === "green") return "success";
  if (status === "yellow") return "warning";
  if (status === "red") return "error";
  return "default";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  rows: IndicatorRow[];
  loading: boolean;
  filterText: string;
  sortField: SortField;
  sortDir: "asc" | "desc";
  onSort: (field: SortField) => void;
  onSelect: (key: string) => void;
}

export default function DiagnosticsIndicatorTable({
  rows,
  loading,
  filterText,
  sortField,
  sortDir,
  onSort,
  onSelect,
}: Props) {
  return (
    <Table size="small" stickyHeader aria-label="Cluster diagnostics indicators">
      <TableHead>
        <TableRow>
          <TableCell>
            <TableSortLabel
              active={sortField === "status"}
              direction={sortField === "status" ? sortDir : "asc"}
              onClick={() => onSort("status")}
            >
              Status
            </TableSortLabel>
          </TableCell>
          <TableCell>
            <TableSortLabel
              active={sortField === "name"}
              direction={sortField === "name" ? sortDir : "asc"}
              onClick={() => onSort("name")}
            >
              Indicator
            </TableSortLabel>
          </TableCell>
          <TableCell>Symptom</TableCell>
          <TableCell>
            <TableSortLabel
              active={sortField === "impactsCount"}
              direction={sortField === "impactsCount" ? sortDir : "asc"}
              onClick={() => onSort("impactsCount")}
            >
              Impacts
            </TableSortLabel>
          </TableCell>
          <TableCell>
            <TableSortLabel
              active={sortField === "diagnosesCount"}
              direction={sortField === "diagnosesCount" ? sortDir : "asc"}
              onClick={() => onSort("diagnosesCount")}
            >
              Diagnoses
            </TableSortLabel>
          </TableCell>
          <TableCell>
            <TableSortLabel
              active={sortField === "worstSeverity"}
              direction={sortField === "worstSeverity" ? sortDir : "asc"}
              onClick={() => onSort("worstSeverity")}
            >
              Worst Severity
            </TableSortLabel>
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={6}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" py={1}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Loading health report...
                </Typography>
              </Stack>
            </TableCell>
          </TableRow>
        ) : rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6}>
              <EmptyState
                size="small"
                heading="No indicators found"
                description={
                  filterText
                    ? "No indicators match the current filter."
                    : "No health indicators available."
                }
              />
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.key} hover>
              <TableCell>
                <Chip
                  size="small"
                  color={indicatorStatusColor(row.status)}
                  label={row.status.toUpperCase()}
                />
              </TableCell>
              <TableCell>
                <Button size="small" onClick={() => onSelect(row.key)}>
                  {row.name}
                </Button>
              </TableCell>
              <TableCell sx={{ maxWidth: 340, whiteSpace: "normal" }}>{row.symptom}</TableCell>
              <TableCell>{row.impactsCount}</TableCell>
              <TableCell>{row.diagnosesCount}</TableCell>
              <TableCell>{row.worstSeverity || "—"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
