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
              <SortHeader field="docsProcessed">Docs Processed</SortHeader>
            </TableCell>
            <TableCell align="right">
              <SortHeader field="docsIndexed">Docs Indexed</SortHeader>
            </TableCell>
            <TableCell align="right">
              <SortHeader field="searchFailures">Search Failures</SortHeader>
            </TableCell>
            <TableCell align="right">
              <SortHeader field="indexFailures">Index Failures</SortHeader>
            </TableCell>
            <TableCell align="right">
              <SortHeader field="checkpoint">Checkpoint</SortHeader>
            </TableCell>
            <TableCell align="right">
              <SortHeader field="avgCheckpointDurationMs">Avg Ckpt Duration</SortHeader>
            </TableCell>
            <TableCell>
              <SortHeader field="nodeName">Node</SortHeader>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              hover
              selected={row.id === selectedId}
              onClick={() => onSelect(row.id)}
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
                  color={healthColor(row.healthStatus)}
                  size="small"
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                <Chip label={row.state} color={stateColor(row.state)} size="small" />
              </TableCell>
              <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{row.id}</TableCell>
              <TableCell>{row.type}</TableCell>
              <TableCell
                sx={{
                  fontSize: "0.75rem",
                  maxWidth: 200,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.sourceIndices.join(", ")} → {row.destIndex}
              </TableCell>
              <TableCell align="right">{formatNum(row.docsProcessed)}</TableCell>
              <TableCell align="right">{formatNum(row.docsIndexed)}</TableCell>
              <TableCell align="right">
                <Typography
                  variant="body2"
                  color={row.searchFailures > 0 ? "error.main" : "text.primary"}
                  fontWeight={row.searchFailures > 0 ? 700 : 400}
                >
                  {formatNum(row.searchFailures)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography
                  variant="body2"
                  color={row.indexFailures > 0 ? "error.main" : "text.primary"}
                  fontWeight={row.indexFailures > 0 ? 700 : 400}
                >
                  {formatNum(row.indexFailures)}
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
