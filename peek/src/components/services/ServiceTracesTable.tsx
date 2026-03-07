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
import type { RecentTrace, TraceSortField } from "./serviceDashboardHelpers";

interface ServiceTracesTableProps {
  traces: RecentTrace[];
  getSortLabelProps: (field: TraceSortField) => {
    active: boolean;
    direction: "asc" | "desc";
    onClick: () => void;
  };
  onViewTrace: (traceId: string) => void;
}

export default function ServiceTracesTable({
  traces,
  getSortLabelProps,
  onViewTrace,
}: ServiceTracesTableProps) {
  return (
    <Table size="small" aria-label="Recent traces">
      <TableHead>
        <TableRow>
          <TableCell>Trace ID</TableCell>
          <TableCell>
            <TableSortLabel {...getSortLabelProps("spanName")}>Operation</TableSortLabel>
          </TableCell>
          <TableCell align="right">
            <TableSortLabel {...getSortLabelProps("durationMs")}>Duration</TableSortLabel>
          </TableCell>
          <TableCell>
            <TableSortLabel {...getSortLabelProps("statusCode")}>Status</TableSortLabel>
          </TableCell>
          <TableCell>
            <TableSortLabel {...getSortLabelProps("timestamp")}>Timestamp</TableSortLabel>
          </TableCell>
          <TableCell align="right">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {traces.map((trace) => {
          const isErrorStatus =
            trace.statusCode === "Error" || trace.statusCode === "STATUS_CODE_ERROR";
          return (
            <TableRow
              key={trace.spanId || `${trace.traceId}-${trace.timestamp}-${trace.spanName}`}
              hover
            >
              <TableCell>
                <Typography
                  variant="body2"
                  sx={{
                    maxWidth: 220,
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
                  color={isErrorStatus ? "error" : "default"}
                  variant={isErrorStatus ? "filled" : "outlined"}
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
          );
        })}
      </TableBody>
    </Table>
  );
}
