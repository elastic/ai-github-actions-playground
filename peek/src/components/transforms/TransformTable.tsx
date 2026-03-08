import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import type { TransformRow } from "../../services/es";

import {
  formatMs,
  formatNum,
  healthColor,
  stateColor,
  type SortDirection,
  type SortField,
} from "./transformSortUtils";

interface TransformTableProps {
  rows: TransformRow[];
  sortField: SortField;
  sortDir: SortDirection;
  selectedId: string | null;
  onSort: (field: SortField) => void;
  onSelect: (id: string) => void;
}

export function TransformTable({
  rows,
  sortField,
  sortDir,
  selectedId,
  onSort,
  onSelect,
}: TransformTableProps) {
  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableSortLabel
      active={sortField === field}
      direction={sortField === field ? sortDir : "asc"}
      onClick={() => onSort(field)}
    >
      {children}
    </TableSortLabel>
  );

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
      <Table size="small" stickyHeader aria-label="Transforms table">
        <TableHead>
          <TableRow>
            <TableCell>
              <SortHeader field="healthStatus">Health</SortHeader>
            </TableCell>
            <TableCell>
              <SortHeader field="state">State</SortHeader>
            </TableCell>
            <TableCell>
              <SortHeader field="id">Transform ID</SortHeader>
            </TableCell>
            <TableCell>
              <SortHeader field="type">Type</SortHeader>
            </TableCell>
            <TableCell>Source → Dest</TableCell>
            <TableCell align="right">
              <SortHeader field="docsProcessed">Docs (P/I)</SortHeader>
            </TableCell>
            <TableCell align="right">
              <SortHeader field="searchFailures">Fail (S/I)</SortHeader>
            </TableCell>
            <TableCell align="right">
              <SortHeader field="checkpoint">Checkpoint</SortHeader>
            </TableCell>
            <TableCell align="right">
              <SortHeader field="avgCheckpointDurationMs">Avg Ckpt</SortHeader>
            </TableCell>
            <TableCell>
              <SortHeader field="nodeName">Node</SortHeader>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No transforms found
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow
              key={row.id}
              hover
              selected={row.id === selectedId}
              onClick={() => onSelect(row.id)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                  event.preventDefault();
                  onSelect(row.id);
                }
              }}
              sx={{
                cursor: "pointer",
                ...(row.state === "failed" && {
                  bgcolor: "error.main",
                  "&:hover": { bgcolor: "error.dark" },
                  "& .MuiTableCell-root": { color: "error.contrastText" },
                }),
              }}
            >
              <TableCell>
                <Chip
                  label={row.healthStatus}
                  color={row.state === "failed" ? "default" : healthColor(row.healthStatus)}
                  size="small"
                  variant={row.state === "failed" ? "filled" : "outlined"}
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={row.state}
                  color={row.state === "failed" ? "default" : stateColor(row.state)}
                  size="small"
                />
              </TableCell>
              <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{row.id}</TableCell>
              <TableCell>{row.type}</TableCell>
              <TableCell
                sx={{
                  fontSize: "0.75rem",
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.sourceIndices.join(", ")} → {row.destIndex}
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                  {formatNum(row.docsProcessed)} / {formatNum(row.docsIndexed)}
                </Typography>
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                <Typography
                  variant="body2"
                  color={
                    row.state === "failed"
                      ? "inherit"
                      : row.searchFailures > 0 || row.indexFailures > 0
                        ? "error.main"
                        : "text.primary"
                  }
                  fontWeight={row.searchFailures > 0 || row.indexFailures > 0 ? 700 : 400}
                  sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                >
                  {formatNum(row.searchFailures)} / {formatNum(row.indexFailures)}
                </Typography>
              </TableCell>
              <TableCell align="right">{formatNum(row.checkpoint)}</TableCell>
              <TableCell align="right">{formatMs(row.avgCheckpointDurationMs)}</TableCell>
              <TableCell>{row.nodeName || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
