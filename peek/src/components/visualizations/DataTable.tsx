import { memo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableContainer from "@mui/material/TableContainer";
import TablePagination from "@mui/material/TablePagination";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";

import type { EsqlResponse, EsqlColumn, TablePanelOptions } from "../../types";
import EmptyState from "../EmptyState";

import RowInspectorFlyout from "./RowInspectorFlyout";
import DataTableHeader from "./DataTableHeader";
import DataTableBody from "./DataTableBody";
import DataTableColumnMenu from "./DataTableColumnMenu";
import type { SortState, SortDirection } from "./dataTableUtils";
import { useDataTableState } from "./useDataTableState";

export type { SortState, SortDirection } from "./dataTableUtils";

interface Props {
  data: EsqlResponse;
  options?: TablePanelOptions;
  onExportCsv?: () => void;
  onRemoveColumn?: (name: string) => void;
  currentSort?: SortState | null;
  onSortChange?: (columnName: string, direction: SortDirection | null) => void;
  onCellClick?: (params: { columnName: string; value: string }) => void;
  /** Enable AI row summaries (requires LLM to be configured). */
  summaryEnabled?: boolean;
  /** Full (unfiltered) result columns — used for richer summary context. */
  fullResultColumns?: EsqlColumn[];
  /** Full (unfiltered) result values — must be index-aligned with `data.values`. */
  fullResultValues?: unknown[][];
}

export default memo(function DataTable({
  data,
  options,
  onExportCsv,
  onRemoveColumn,
  currentSort,
  onSortChange,
  onCellClick,
  summaryEnabled,
  fullResultColumns,
  fullResultValues,
}: Props) {
  const s = useDataTableState({
    data,
    currentSort,
    onSortChange,
    summaryEnabled,
    fullResultColumns,
    fullResultValues,
  });

  if (data.columns.length === 0) {
    return <EmptyState size="small" heading="No data" />;
  }

  const hiddenCount = s.emptyColumnIndices.size;

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", height: "100%" }}
      onKeyDown={s.handleKeyDown}
    >
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
            {s.showEmptyColumns
              ? `${hiddenCount} empty ${hiddenCount === 1 ? "column" : "columns"}`
              : `${hiddenCount} empty ${hiddenCount === 1 ? "column" : "columns"} hidden`}
          </Typography>
          <Link
            component="button"
            variant="caption"
            onClick={() => s.setShowEmptyColumns((prev) => !prev)}
            sx={{ cursor: "pointer" }}
          >
            {s.showEmptyColumns ? "Hide" : "Show"}
          </Link>
        </Box>
      )}
      <TableContainer ref={s.tableContainerRef} sx={{ flex: 1, minHeight: 0 }}>
        <Table size="small" stickyHeader>
          <DataTableHeader
            data={data}
            orderedVisibleColumnIndices={s.orderedVisibleColumnIndices}
            currentSort={currentSort}
            pinnedColumns={s.pinnedColumns}
            pinnedLeftOffsets={s.pinnedLeftOffsets}
            onSortToggle={s.handleSortToggle}
            showSummaryColumn={Boolean(summaryEnabled)}
            onOpenMenu={(event, colIdx) => {
              s.setMenuAnchor(event.currentTarget);
              s.setMenuColumnIndex(colIdx);
            }}
          />
          <DataTableBody
            data={data}
            options={options}
            visibleRows={s.visibleRows}
            orderedVisibleColumnIndices={s.orderedVisibleColumnIndices}
            pinnedColumns={s.pinnedColumns}
            pinnedLeftOffsets={s.pinnedLeftOffsets}
            page={s.page}
            rowsPerPage={s.rowsPerPage}
            onRowClick={s.handleRowClick}
            selectedRowIndex={s.selectedRowIndex}
            onCellClick={onCellClick}
            rowSummaries={summaryEnabled ? s.rowSummaries : undefined}
            observeSummaryRow={summaryEnabled ? s.observeSummaryRow : undefined}
            unobserveSummaryRow={summaryEnabled ? s.unobserveSummaryRow : undefined}
          />
        </Table>
        {data.values.length === 0 && (
          <EmptyState
            size="small"
            heading="No results match your query"
            description="Try adjusting your filters or time range."
          />
        )}
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
          page={s.page}
          onPageChange={(_, nextPage) => s.setPage(nextPage)}
          rowsPerPage={s.rowsPerPage}
          onRowsPerPageChange={(event) => {
            s.setRowsPerPage(parseInt(event.target.value, 10));
            s.setPage(0);
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
        open={s.inspectedRowState !== null && s.selectedRowIndex !== null}
        onClose={s.handleCloseInspector}
        columns={data.columns}
        row={s.inspectedRowState?.row ?? null}
      />
      <DataTableColumnMenu
        data={data}
        menuAnchor={s.menuAnchor}
        menuColumnIndex={s.menuColumnIndex}
        orderedColumnIndices={s.orderedVisibleColumnIndices}
        pinnedColumns={s.pinnedColumns}
        onSortChange={onSortChange}
        onRemoveColumn={onRemoveColumn}
        onMoveColumn={s.moveColumn}
        onPinColumn={s.handlePinColumn}
        onUnpinColumn={s.handleUnpinColumn}
        onClose={s.closeMenu}
        onResetPage={() => s.setPage(0)}
      />
    </Box>
  );
});
