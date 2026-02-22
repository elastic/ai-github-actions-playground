import { useMemo, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import type { EsqlResponse } from "../../types";
import { getEmptyColumnIndices, paginateRows } from "../discoverUtils";
import { isNumericType } from "./chartUtils";
import RowInspectorFlyout from "./RowInspectorFlyout";

type SortDirection = "asc" | "desc";

function reconcileColumnOrder(order: number[], allIndices: number[]): number[] {
  const kept = order.filter((i) => allIndices.includes(i));
  const missing = allIndices.filter((i) => !kept.includes(i));
  return [...kept, ...missing];
}

interface Props {
  data: EsqlResponse;
  onExportCsv?: () => void;
  onRemoveColumn?: (name: string) => void;
}

export default function DataTable({ data, onExportCsv, onRemoveColumn }: Props) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [inspectedRow, setInspectedRow] = useState<unknown[] | null>(null);
  const [showEmptyColumns, setShowEmptyColumns] = useState(false);
  const [columnOrder, setColumnOrder] = useState<number[]>(() => data.columns.map((_, i) => i));
  const [sort, setSort] = useState<{ columnIndex: number; direction: SortDirection } | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuColumnIndex, setMenuColumnIndex] = useState<number | null>(null);
  const allColumnIndices = useMemo(() => data.columns.map((_, i) => i), [data.columns]);
  const resolvedColumnOrder = useMemo(
    () => reconcileColumnOrder(columnOrder, allColumnIndices),
    [columnOrder, allColumnIndices],
  );

  const emptyColumnIndices = useMemo(() => getEmptyColumnIndices(data), [data]);

  const orderedVisibleColumnIndices = useMemo(() => {
    const visible = showEmptyColumns
      ? allColumnIndices
      : allColumnIndices.filter((i) => !emptyColumnIndices.has(i));
    return resolvedColumnOrder.filter((i) => visible.includes(i));
  }, [allColumnIndices, emptyColumnIndices, showEmptyColumns, resolvedColumnOrder]);

  const sortedRows = useMemo(() => {
    if (!sort) return data.values;
    const column = data.columns[sort.columnIndex];
    if (!column) return data.values;
    const multiplier = sort.direction === "asc" ? 1 : -1;
    return [...data.values].sort((a, b) => {
      const left = a[sort.columnIndex];
      const right = b[sort.columnIndex];
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      if (isNumericType(column.type)) return (Number(left) - Number(right)) * multiplier;
      if (column.type === "date" || column.type === "date_nanos") {
        const leftTime = Date.parse(String(left));
        const rightTime = Date.parse(String(right));
        if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime))
          return (leftTime - rightTime) * multiplier;
      }
      return String(left).localeCompare(String(right), undefined, { numeric: true }) * multiplier;
    });
  }, [data.columns, data.values, sort]);

  const visibleRows = useMemo(
    () => paginateRows(sortedRows, page, rowsPerPage),
    [sortedRows, page, rowsPerPage],
  );

  const handleRowClick = useCallback((row: unknown[]) => {
    setInspectedRow(row);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setInspectedRow(null);
  }, []);

  const handleSortToggle = useCallback((columnIndex: number) => {
    setSort((prev) => {
      if (!prev || prev.columnIndex !== columnIndex) return { columnIndex, direction: "asc" };
      if (prev.direction === "asc") return { columnIndex, direction: "desc" };
      return null;
    });
    setPage(0);
  }, []);

  const moveColumn = useCallback(
    (columnIndex: number, direction: "left" | "right") => {
      setColumnOrder((prev) => {
        const nextIndices = data.columns.map((_, i) => i);
        const normalized = reconcileColumnOrder(prev, nextIndices);
        const from = normalized.indexOf(columnIndex);
        if (from < 0) return prev;
        const to = direction === "left" ? from - 1 : from + 1;
        if (to < 0 || to >= normalized.length) return prev;
        const next = [...normalized];
        [next[from], next[to]] = [next[to]!, next[from]!];
        return next;
      });
    },
    [data.columns],
  );

  const closeMenu = useCallback(() => {
    setMenuAnchor(null);
    setMenuColumnIndex(null);
  }, []);

  if (data.columns.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
        No data
      </Typography>
    );
  }

  const hiddenCount = emptyColumnIndices.size;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {hiddenCount > 0 && (
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {showEmptyColumns
              ? `${hiddenCount} empty ${hiddenCount === 1 ? "column" : "columns"}`
              : `${hiddenCount} empty ${hiddenCount === 1 ? "column" : "columns"} hidden`}
          </Typography>
          <Link
            component="button"
            variant="caption"
            onClick={() => setShowEmptyColumns((prev) => !prev)}
            sx={{ cursor: "pointer" }}
          >
            {showEmptyColumns ? "Hide" : "Show"}
          </Link>
        </Box>
      )}
      <TableContainer sx={{ flex: 1, minHeight: 0 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {orderedVisibleColumnIndices.map((colIdx) => {
                const col = data.columns[colIdx]!;
                const isSorted = sort?.columnIndex === colIdx;
                return (
                  <TableCell
                    key={col.name}
                    sx={{
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      fontSize: "0.75rem",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                      <TableSortLabel
                        active={isSorted}
                        direction={isSorted ? sort.direction : "asc"}
                        onClick={() => handleSortToggle(colIdx)}
                      >
                        {col.name}
                      </TableSortLabel>
                      <Typography component="span" variant="caption" sx={{ opacity: 0.5 }}>
                        {col.type}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label={`column actions for ${col.name}`}
                        onClick={(event) => {
                          setMenuAnchor(event.currentTarget);
                          setMenuColumnIndex(colIdx);
                        }}
                      >
                        <MoreVertIcon fontSize="inherit" />
                      </IconButton>
                    </Box>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
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
                  onClick={() => handleRowClick(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleRowClick(row);
                    }
                  }}
                  sx={{ cursor: "pointer" }}
                >
                  {orderedVisibleColumnIndices.map((colIdx) => {
                    const col = data.columns[colIdx];
                    const cell = row[colIdx];
                    const numeric = col ? isNumericType(col.type) : false;
                    return (
                      <TableCell
                        key={colIdx}
                        sx={{
                          whiteSpace: "nowrap",
                          fontSize: "0.75rem",
                          fontFamily: numeric ? "monospace" : "inherit",
                          textAlign: numeric ? "right" : "left",
                        }}
                      >
                        {cell === null ? (
                          <Typography component="span" variant="caption" sx={{ opacity: 0.3 }}>
                            null
                          </Typography>
                        ) : (
                          String(cell)
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </Tooltip>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          borderTop: 1,
          borderColor: "divider",
          px: 1,
        }}
      >
        <TablePagination
          component="div"
          count={sortedRows.length}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[25, 50, 100]}
          sx={{ flex: 1 }}
        />
        {onExportCsv && (
          <Tooltip title="Export all results with selected columns as CSV">
            <Button size="small" variant="text" startIcon={<DownloadIcon />} onClick={onExportCsv}>
              Export CSV
            </Button>
          </Tooltip>
        )}
      </Box>
      <RowInspectorFlyout
        open={inspectedRow !== null}
        onClose={handleCloseInspector}
        columns={data.columns}
        row={inspectedRow}
      />
      <Menu anchorEl={menuAnchor} open={menuColumnIndex !== null} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (menuColumnIndex !== null) {
              setSort({ columnIndex: menuColumnIndex, direction: "asc" });
              setPage(0);
            }
            closeMenu();
          }}
        >
          Sort A→Z
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuColumnIndex !== null) {
              setSort({ columnIndex: menuColumnIndex, direction: "desc" });
              setPage(0);
            }
            closeMenu();
          }}
        >
          Sort Z→A
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuColumnIndex !== null) moveColumn(menuColumnIndex, "left");
            closeMenu();
          }}
        >
          Move column left
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuColumnIndex !== null) moveColumn(menuColumnIndex, "right");
            closeMenu();
          }}
        >
          Move column right
        </MenuItem>
        <MenuItem
          disabled={menuColumnIndex === null || !onRemoveColumn}
          onClick={() => {
            if (menuColumnIndex !== null) {
              const column = data.columns[menuColumnIndex];
              if (column && onRemoveColumn) onRemoveColumn(column.name);
            }
            closeMenu();
          }}
        >
          Remove column
        </MenuItem>
      </Menu>
    </Box>
  );
}
