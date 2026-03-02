import { useCallback } from "react";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import type { EsqlResponse } from "../../types";

import type { SortDirection } from "./dataTableUtils";

interface DataTableColumnMenuProps {
  data: EsqlResponse;
  orderedColumnIndices: number[];
  menuAnchor: HTMLElement | null;
  menuColumnIndex: number | null;
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
  orderedColumnIndices,
  menuAnchor,
  menuColumnIndex,
  pinnedColumns,
  onSortChange,
  onRemoveColumn,
  onMoveColumn,
  onPinColumn,
  onUnpinColumn,
  onClose,
  onResetPage,
}: DataTableColumnMenuProps) {
  const closeMenu = useCallback(() => {
    onClose();
  }, [onClose]);
  const menuPosition =
    menuColumnIndex === null ? -1 : orderedColumnIndices.indexOf(menuColumnIndex);
  const isFirstColumn = menuPosition === 0;
  const isLastColumn = menuPosition === orderedColumnIndices.length - 1;

  return (
    <Menu anchorEl={menuAnchor} open={menuColumnIndex !== null} onClose={closeMenu}>
      <MenuItem
        disabled={!onSortChange}
        onClick={() => {
          if (menuColumnIndex !== null && onSortChange) {
            const col = data.columns[menuColumnIndex];
            if (col) onSortChange(col.name, "asc");
            onResetPage();
          }
          closeMenu();
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
          closeMenu();
        }}
      >
        Sort Z→A
      </MenuItem>
      <MenuItem
        disabled={menuColumnIndex === null || isFirstColumn}
        onClick={() => {
          if (menuColumnIndex !== null) onMoveColumn(menuColumnIndex, "left");
          closeMenu();
        }}
      >
        Move column left
      </MenuItem>
      <MenuItem
        disabled={menuColumnIndex === null || isLastColumn}
        onClick={() => {
          if (menuColumnIndex !== null) onMoveColumn(menuColumnIndex, "right");
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
      {menuColumnIndex !== null && !pinnedColumns.has(menuColumnIndex) && (
        <MenuItem
          onClick={() => {
            onPinColumn(menuColumnIndex);
            closeMenu();
          }}
        >
          Pin left
        </MenuItem>
      )}
      {menuColumnIndex !== null && pinnedColumns.has(menuColumnIndex) && (
        <MenuItem
          onClick={() => {
            onUnpinColumn(menuColumnIndex);
            closeMenu();
          }}
        >
          Unpin
        </MenuItem>
      )}
    </Menu>
  );
}
