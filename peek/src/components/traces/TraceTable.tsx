import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";

import { formatTimestamp } from "../../utils/formatDate";

import { getServiceColor } from "./traceColors";
import { formatSpanDuration } from "./traceUtils";
import type { Span } from "./traceUtils";

type TraceRow = Pick<
  Span,
  "traceId" | "spanId" | "serviceName" | "name" | "durationUs" | "status" | "timestamp"
>;

interface TraceTableProps {
  traceRows: TraceRow[];
  selectedTraceId: string | null;
  onSelectTrace: (traceId: string, spanId?: string, timestamp?: string) => void;
  maxDuration: number;
}

export function TraceTable({
  traceRows,
  selectedTraceId,
  onSelectTrace,
  maxDuration,
}: TraceTableProps) {
  return (
    <TableContainer
      component={Box}
      sx={{
        maxHeight: 600,
        overflow: "auto",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
      <Table stickyHeader size="small" aria-label="traces table">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Trace ID</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Service</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Duration</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {traceRows.map((row, idx) => {
            const isSelected = selectedTraceId === row.traceId;
            return (
              <TableRow
                key={`${row.traceId}-${idx}`}
                hover
                tabIndex={0}
                onClick={() => onSelectTrace(row.traceId, row.spanId, row.timestamp)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectTrace(row.traceId, row.spanId, row.timestamp);
                  }
                }}
                selected={isSelected}
                sx={{
                  cursor: "pointer",
                  "&.Mui-selected": {
                    backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
                    "&:hover": {
                      backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.15),
                    },
                  },
                }}
              >
                <TableCell
                  sx={{
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                  }}
                >
                  {row.traceId.slice(0, 16)}…
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                    <Box
                      sx={{
                        flexShrink: 0,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: getServiceColor(row.serviceName),
                      }}
                    />
                    {row.serviceName}
                  </Box>
                </TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <Box
                      sx={{
                        width: 60,
                        height: 4,
                        overflow: "hidden",
                        borderRadius: 1,
                        bgcolor: "action.hover",
                      }}
                    >
                      <Box
                        sx={{
                          width: `${Math.max(2, (row.durationUs / maxDuration) * 100)}%`,
                          height: "100%",
                          borderRadius: 1,
                          bgcolor: getServiceColor(row.serviceName),
                        }}
                      />
                    </Box>
                    <Typography variant="caption">{formatSpanDuration(row.durationUs)}</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  {(() => {
                    const isError = row.status === "Error" || row.status === "STATUS_CODE_ERROR";
                    const label = isError ? "Error" : "OK";
                    return (
                      <Chip
                        size="small"
                        label={label}
                        color={isError ? "error" : "success"}
                        variant="outlined"
                        aria-label={`Status: ${label}`}
                      />
                    );
                  })()}
                </TableCell>
                <TableCell sx={{ fontSize: "0.75rem" }}>
                  {row.timestamp ? formatTimestamp(row.timestamp) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
