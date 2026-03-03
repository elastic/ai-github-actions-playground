import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";

import { formatLatency } from "./serviceInventoryHelpers";
import type { RecentTrace, TraceSortField, SortDirection } from "./serviceDashboardHelpers";

interface ServiceTracesTableProps {
  traces: RecentTrace[];
  sortField: TraceSortField;
  sortDirection: SortDirection;
  onSort: (field: TraceSortField) => void;
  onViewTrace: (traceId: string) => void;
}

export default function ServiceTracesTable({
  traces,
  sortField,
  sortDirection,
  onSort,
  onViewTrace,
}: ServiceTracesTableProps) {
  return (
    <Table size="small" aria-label="Recent traces">
      <TableHead>
        <TableRow>
          <TableCell>Trace ID</TableCell>
          <TableCell>
            <TableSortLabel
              active={sortField === "spanName"}
              direction={sortField === "spanName" ? sortDirection : "asc"}
              onClick={() => onSort("spanName")}
            >
              Operation
            </TableSortLabel>
          </TableCell>
          <TableCell align="right">
            <TableSortLabel
              active={sortField === "durationMs"}
              direction={sortField === "durationMs" ? sortDirection : "desc"}
              onClick={() => onSort("durationMs")}
            >
              Duration
            </TableSortLabel>
          </TableCell>
          <TableCell>
            <TableSortLabel
              active={sortField === "statusCode"}
              direction={sortField === "statusCode" ? sortDirection : "asc"}
              onClick={() => onSort("statusCode")}
            >
              Status
            </TableSortLabel>
          </TableCell>
          <TableCell>
            <TableSortLabel
              active={sortField === "timestamp"}
              direction={sortField === "timestamp" ? sortDirection : "desc"}
              onClick={() => onSort("timestamp")}
            >
              Timestamp
            </TableSortLabel>
          </TableCell>
          <TableCell align="right">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {traces.map((trace) => (
          <TableRow key={`${trace.traceId}-${trace.timestamp}-${trace.spanName}`} hover>
            <TableCell>
              <Typography
                variant="body2"
                sx={{
                  maxWidth: 140,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                }}
              >
                {trace.traceId}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2">{trace.spanName}</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2">{formatLatency(trace.durationMs)}</Typography>
            </TableCell>
            <TableCell>
              <Chip
                size="small"
                label={trace.statusCode || "OK"}
                color={
                  trace.statusCode === "Error" || trace.statusCode === "STATUS_CODE_ERROR"
                    ? "error"
                    : "default"
                }
                variant={
                  trace.statusCode === "Error" || trace.statusCode === "STATUS_CODE_ERROR"
                    ? "filled"
                    : "outlined"
                }
              />
            </TableCell>
            <TableCell>
              <Typography variant="body2" color="text.secondary">
                {trace.timestamp}
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Button
                size="small"
                variant="text"
                aria-label={`View trace ${trace.traceId}`}
                onClick={() => onViewTrace(trace.traceId)}
              >
                View
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
