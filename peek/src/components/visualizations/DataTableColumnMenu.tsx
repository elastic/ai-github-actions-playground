import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import type { EsqlResponse } from "../../types";

import type { SortDirection } from "./dataTableUtils";

interface DataTableColumnMenuProps {
  data: EsqlResponse;
  menuAnchor: HTMLElement | null;
  menuColumnIndex: number | null;
  orderedColumnIndices: number[];
  pinnedColumns: Set<number>;
  onSortChange?: (columnName: string, direction: SortDirection | null) => void;
  onRemoveColumn?: (name: string) => void;
  onMoveColumn: (columnIndex: number, direction: "left" | "right") => void;
  onPinColumn: (columnIndex: number) => void;
  onUnpinColumn: (columnIndex: number) => void;
  onClose: () => void;
  onResetPage: () => void;
}

export default function DataTableColumnMenu({
  data,
  menuAnchor,
  menuColumnIndex,
  orderedColumnIndices,
  pinnedColumns,
  onSortChange,
  onRemoveColumn,
  onMoveColumn,
  onPinColumn,
  onUnpinColumn,
  onClose,
  onResetPage,
}: DataTableColumnMenuProps) {
  const menuPosition =
    menuColumnIndex !== null ? orderedColumnIndices.indexOf(menuColumnIndex) : -1;

  return (
    <Menu anchorEl={menuAnchor} open={menuColumnIndex !== null} onClose={onClose}>
      <MenuItem
        disabled={!onSortChange}
        onClick={() => {
          if (menuColumnIndex !== null && onSortChange) {
            const col = data.columns[menuColumnIndex];
            if (col) onSortChange(col.name, "asc");
            onResetPage();
          }
          onClose();
        }}
      >
        Sort A→Z
      </MenuItem>
      <MenuItem
        disabled={!onSortChange}
        onClick={() => {
          if (menuColumnIndex !== null && onSortChange) {
            const col = data.columns[menuColumnIndex];
            if (col) onSortChange(col.name, "desc");
            onResetPage();
          }
          onClose();
        }}
      >
        Sort Z→A
      </MenuItem>
      <MenuItem
        disabled={menuPosition <= 0}
        onClick={() => {
          if (menuColumnIndex !== null) onMoveColumn(menuColumnIndex, "left");
          onClose();
        }}
      >
        Move column left
      </MenuItem>
      <MenuItem
        disabled={menuPosition < 0 || menuPosition >= orderedColumnIndices.length - 1}
        onClick={() => {
          if (menuColumnIndex !== null) onMoveColumn(menuColumnIndex, "right");
          onClose();
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
          onClose();
        }}
      >
        Remove column
      </MenuItem>
      {menuColumnIndex !== null && !pinnedColumns.has(menuColumnIndex) && (
        <MenuItem
          onClick={() => {
            onPinColumn(menuColumnIndex);
            onClose();
          }}
        >
          Pin left
        </MenuItem>
      )}
      {menuColumnIndex !== null && pinnedColumns.has(menuColumnIndex) && (
        <MenuItem
          onClick={() => {
            onUnpinColumn(menuColumnIndex);
            onClose();
          }}
        >
          Unpin
        </MenuItem>
      )}
    </Menu>
  );
}
