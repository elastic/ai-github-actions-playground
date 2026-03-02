import { useMemo, useState, useCallback, memo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableContainer from "@mui/material/TableContainer";
import TablePagination from "@mui/material/TablePagination";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";

import type { EsqlResponse, TablePanelOptions } from "../../types";
import EmptyState from "../EmptyState";
import { getEmptyColumnIndices, paginateRows } from "../discoverUtils";

import RowInspectorFlyout from "./RowInspectorFlyout";
import DataTableHeader from "./DataTableHeader";
import DataTableBody from "./DataTableBody";
import DataTableColumnMenu from "./DataTableColumnMenu";
import type { SortState } from "./dataTableUtils";
import { PINNED_COLUMN_MIN_WIDTH, reconcileColumnOrder } from "./dataTableUtils";

export type { SortState } from "./dataTableUtils";

interface Props {
  data: EsqlResponse;
  options?: TablePanelOptions;
  onExportCsv?: () => void;
  onRemoveColumn?: (name: string) => void;
  currentSort?: SortState | null;
  onSortChange?: (columnName: string, direction: "asc" | "desc" | null) => void;
}

export default memo(function DataTable({
  data,
  options,
  onExportCsv,
  onRemoveColumn,
  currentSort,
  onSortChange,
}: Props) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [inspectedRow, setInspectedRow] = useState<unknown[] | null>(null);
  const [showEmptyColumns, setShowEmptyColumns] = useState(false);
  const [columnOrder, setColumnOrder] = useState<number[]>(() => data.columns.map((_, i) => i));
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuColumnIndex, setMenuColumnIndex] = useState<number | null>(null);
  const [pinnedColumns, setPinnedColumns] = useState<Set<number>>(new Set());
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
    const visibleSet = new Set(visible);
    const ordered = resolvedColumnOrder.filter((i) => visibleSet.has(i));
    const pinned = ordered.filter((i) => pinnedColumns.has(i));
    const unpinned = ordered.filter((i) => !pinnedColumns.has(i));
    return [...pinned, ...unpinned];
  }, [allColumnIndices, emptyColumnIndices, showEmptyColumns, resolvedColumnOrder, pinnedColumns]);

  const pinnedLeftOffsets = useMemo(() => {
    const offsets = new Map<number, number>();
    let accumulated = 0;
    for (const colIdx of orderedVisibleColumnIndices) {
      if (!pinnedColumns.has(colIdx)) break;
      offsets.set(colIdx, accumulated);
      accumulated += PINNED_COLUMN_MIN_WIDTH;
    }
    return offsets;
  }, [pinnedColumns, orderedVisibleColumnIndices]);

  const visibleRows = useMemo(
    () => paginateRows(data.values, page, rowsPerPage),
    [data.values, page, rowsPerPage],
  );

  const handleRowClick = useCallback((row: unknown[]) => {
    setInspectedRow(row);
  }, []);

  const handleCloseInspector = useCallback(() => {
    setInspectedRow(null);
  }, []);

  const handleSortToggle = useCallback(
    (columnName: string) => {
      if (!onSortChange) return;
      if (!currentSort || currentSort.columnName !== columnName) {
        onSortChange(columnName, "asc");
      } else if (currentSort.direction === "asc") {
        onSortChange(columnName, "desc");
      } else {
        onSortChange(columnName, null);
      }
      setPage(0);
    },
    [currentSort, onSortChange],
  );

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

  const handlePinColumn = useCallback((colIdx: number) => {
    setPinnedColumns((prev) => {
      const next = new Set(prev);
      next.add(colIdx);
      return next;
    });
  }, []);

  const handleUnpinColumn = useCallback((colIdx: number) => {
    setPinnedColumns((prev) => {
      const next = new Set(prev);
      next.delete(colIdx);
      return next;
    });
  }, []);

  if (data.columns.length === 0) {
    return <EmptyState size="small" heading="No data" />;
  }

  const hiddenCount = emptyColumnIndices.size;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {hiddenCount > 0 && (
        <Box
          sx={{
            display: "flex",
            gap: 0.5,
            alignItems: "center",
            py: 0.5,
            px: 1.5,
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
          <DataTableHeader
            data={data}
            orderedVisibleColumnIndices={orderedVisibleColumnIndices}
            currentSort={currentSort}
            pinnedColumns={pinnedColumns}
            pinnedLeftOffsets={pinnedLeftOffsets}
            onSortToggle={handleSortToggle}
            onOpenMenu={(event, colIdx) => {
              setMenuAnchor(event.currentTarget);
              setMenuColumnIndex(colIdx);
            }}
          />
          <DataTableBody
            data={data}
            options={options}
            visibleRows={visibleRows}
            orderedVisibleColumnIndices={orderedVisibleColumnIndices}
            pinnedColumns={pinnedColumns}
            pinnedLeftOffsets={pinnedLeftOffsets}
            page={page}
            rowsPerPage={rowsPerPage}
            onRowClick={handleRowClick}
          />
        </Table>
      </TableContainer>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1,
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <TablePagination
          component="div"
          count={data.values.length}
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
      <DataTableColumnMenu
        data={data}
        orderedColumnIndices={resolvedColumnOrder}
        menuAnchor={menuAnchor}
        menuColumnIndex={menuColumnIndex}
        pinnedColumns={pinnedColumns}
        onSortChange={onSortChange}
        onRemoveColumn={onRemoveColumn}
        onMoveColumn={moveColumn}
        onPinColumn={handlePinColumn}
        onUnpinColumn={handleUnpinColumn}
        onClose={closeMenu}
        onResetPage={() => setPage(0)}
      />
    </Box>
  );
});
