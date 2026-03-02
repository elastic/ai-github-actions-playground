import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";
import MoreVertIcon from "@mui/icons-material/MoreVert";

import type { EsqlResponse } from "../../types";

import type { SortState } from "./dataTableUtils";
import { PINNED_COLUMN_MIN_WIDTH } from "./dataTableUtils";

interface DataTableHeaderProps {
  data: EsqlResponse;
  orderedVisibleColumnIndices: number[];
  currentSort?: SortState | null;
  pinnedColumns: Set<number>;
  pinnedLeftOffsets: Map<number, number>;
  onSortToggle: (columnName: string) => void;
  onOpenMenu: (event: React.MouseEvent<HTMLButtonElement>, colIdx: number) => void;
}

export default function DataTableHeader({
  data,
  orderedVisibleColumnIndices,
  currentSort,
  pinnedColumns,
  pinnedLeftOffsets,
  onSortToggle,
  onOpenMenu,
}: DataTableHeaderProps) {
  return (
    <TableHead>
      <TableRow>
        {orderedVisibleColumnIndices.map((colIdx) => {
          const col = data.columns[colIdx];
          if (!col) return null;
          const isSorted = currentSort?.columnName === col.name;
          const isPinned = pinnedColumns.has(colIdx);
          const stickyLeft = isPinned ? (pinnedLeftOffsets.get(colIdx) ?? 0) : undefined;
          return (
            <TableCell
              key={col.name}
              sx={{
                whiteSpace: "nowrap",
                fontWeight: 600,
                fontSize: "0.75rem",
                ...(isPinned
                  ? {
                      position: "sticky",
                      zIndex: 4,
                      left: stickyLeft,
                      width: PINNED_COLUMN_MIN_WIDTH,
                      minWidth: PINNED_COLUMN_MIN_WIDTH,
                      maxWidth: PINNED_COLUMN_MIN_WIDTH,
                      overflow: "hidden",
                      borderRight: "1px solid",
                      borderRightColor: "divider",
                      backgroundColor: "background.paper",
                    }
                  : {}),
              }}
            >
              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                <Box
                  sx={
                    isPinned
                      ? {
                          display: "flex",
                          flex: 1,
                          gap: 0.25,
                          alignItems: "center",
                          minWidth: 0,
                          overflow: "hidden",
                        }
                      : { display: "contents" }
                  }
                >
                  <TableSortLabel
                    active={isSorted}
                    direction={isSorted ? currentSort!.direction : "asc"}
                    onClick={() => onSortToggle(col.name)}
                    sx={
                      isPinned
                        ? {
                            overflow: "hidden",
                          }
                        : {}
                    }
                  >
                    {col.name}
                  </TableSortLabel>
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ flexShrink: 0, opacity: 0.5 }}
                  >
                    {col.type}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  aria-label={`column actions for ${col.name}`}
                  onClick={(event) => onOpenMenu(event, colIdx)}
                >
                  <MoreVertIcon fontSize="inherit" />
                </IconButton>
              </Box>
            </TableCell>
          );
        })}
      </TableRow>
    </TableHead>
  );
}
