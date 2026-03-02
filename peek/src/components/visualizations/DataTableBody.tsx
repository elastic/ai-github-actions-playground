import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import type { EsqlResponse, TablePanelOptions } from "../../types";

import { isNumericType } from "./chartUtils";
import { resolveThresholdColor, THRESHOLD_PALETTE } from "./thresholdUtils";
import TruncatedCell from "./TruncatedCell";
import { PINNED_COLUMN_MIN_WIDTH } from "./dataTableUtils";

interface DataTableBodyProps {
  data: EsqlResponse;
  options?: TablePanelOptions;
  visibleRows: unknown[][];
  orderedVisibleColumnIndices: number[];
  pinnedColumns: Set<number>;
  pinnedLeftOffsets: Map<number, number>;
  page: number;
  rowsPerPage: number;
  onRowClick: (row: unknown[]) => void;
  selectedRowIndex?: number | null;
}

export default function DataTableBody({
  data,
  options,
  visibleRows,
  orderedVisibleColumnIndices,
  pinnedColumns,
  pinnedLeftOffsets,
  page,
  rowsPerPage,
  onRowClick,
  selectedRowIndex,
}: DataTableBodyProps) {
  return (
    <TableBody>
      {visibleRows.map((row, rowIdx) => (
        <Tooltip
          key={page * rowsPerPage + rowIdx}
          title="Click to inspect row"
          placement="left"
          enterDelay={600}
        >
          <TableRow
            hover
            tabIndex={0}
            data-row-index={rowIdx}
            selected={selectedRowIndex === rowIdx}
            onClick={() => onRowClick(row)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onRowClick(row);
              }
            }}
            sx={{ cursor: "pointer" }}
          >
            {orderedVisibleColumnIndices.map((colIdx) => {
              const col = data.columns[colIdx];
              if (!col) return null;
              const cell = row[colIdx];
              const numeric = isNumericType(col.type);
              const thresholds = options?.thresholds;
              const thresholdColumns = options?.thresholdColumns;
              const applyThreshold =
                numeric &&
                thresholds &&
                thresholds.steps.length > 0 &&
                cell != null &&
                (!thresholdColumns ||
                  thresholdColumns.length === 0 ||
                  thresholdColumns.includes(col.name));
              const thresholdColor = applyThreshold
                ? resolveThresholdColor(Number(cell), thresholds!)
                : undefined;
              const bgColor = thresholdColor ? `${THRESHOLD_PALETTE[thresholdColor]}26` : undefined;
              const isPinned = pinnedColumns.has(colIdx);
              const stickyLeft = isPinned ? (pinnedLeftOffsets.get(colIdx) ?? 0) : undefined;
              return (
                <TableCell
                  key={colIdx}
                  sx={{
                    maxWidth: isPinned ? undefined : 400,
                    textAlign: numeric ? "right" : "left",
                    wordBreak: isPinned ? "normal" : "break-word",
                    whiteSpace: isPinned ? "nowrap" : "normal",
                    fontSize: "0.75rem",
                    fontFamily: numeric ? "monospace" : "inherit",
                    ...(bgColor ? { backgroundColor: bgColor } : {}),
                    ...(isPinned
                      ? {
                          position: "sticky",
                          zIndex: 1,
                          left: stickyLeft,
                          width: PINNED_COLUMN_MIN_WIDTH,
                          minWidth: PINNED_COLUMN_MIN_WIDTH,
                          maxWidth: PINNED_COLUMN_MIN_WIDTH,
                          overflow: "hidden",
                          borderRight: "1px solid",
                          borderRightColor: "divider",
                          backgroundColor: bgColor ?? "background.paper",
                          textOverflow: "ellipsis",
                        }
                      : {}),
                  }}
                >
                  {cell == null ? (
                    <Typography component="span" variant="caption" sx={{ opacity: 0.3 }}>
                      null
                    </Typography>
                  ) : (
                    <TruncatedCell value={String(cell)} />
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        </Tooltip>
      ))}
    </TableBody>
  );
}
