import { useMemo, useState, useCallback, useRef, useEffect } from "react";

import type { EsqlResponse, EsqlColumn } from "../../types";
import { useRowSummaries } from "../../hooks/useRowSummaries";
import { getEmptyColumnIndices, paginateRows } from "../discoverUtils";

import {
  PINNED_COLUMN_MIN_WIDTH,
  reconcileColumnOrder,
  createInspectedRowState,
  type SortState,
  type SortDirection,
  type InspectedRowState,
} from "./dataTableUtils";

interface UseDataTableStateOptions {
  data: EsqlResponse;
  currentSort?: SortState | null;
  onSortChange?: (columnName: string, direction: SortDirection | null) => void;
  summaryEnabled?: boolean;
  fullResultColumns?: EsqlColumn[];
  fullResultValues?: unknown[][];
}

export function useDataTableState({
  data,
  currentSort,
  onSortChange,
  summaryEnabled,
  fullResultColumns,
  fullResultValues,
}: UseDataTableStateOptions) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [inspectedRowState, setInspectedRowState] = useState<InspectedRowState | null>(null);
  const [showEmptyColumns, setShowEmptyColumns] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [columnOrder, setColumnOrder] = useState<number[]>(() => data.columns.map((_, i) => i));
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuColumnIndex, setMenuColumnIndex] = useState<number | null>(null);
  const [pinnedColumns, setPinnedColumns] = useState<Set<number>>(new Set());

  const allColumnIndices = useMemo(() => data.columns.map((_, i) => i), [data.columns]);
  useEffect(() => {
    setColumnOrder(data.columns.map((_, i) => i));
  }, [data.columns]);
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

  const summaryPageRows = useMemo(
    () => (fullResultValues ? paginateRows(fullResultValues, page, rowsPerPage) : visibleRows),
    [fullResultValues, page, rowsPerPage, visibleRows],
  );
  const summaryColumns = fullResultColumns ?? data.columns;

  const {
    summaries: rowSummaries,
    observeRow: observeSummaryRow,
    unobserveRow: unobserveSummaryRow,
  } = useRowSummaries(summaryColumns, summaryPageRows, Boolean(summaryEnabled));

  const visibleRowKeys = useMemo(
    () => visibleRows.map((row) => JSON.stringify(row)),
    [visibleRows],
  );

  const selectedRowIndex = useMemo(() => {
    if (inspectedRowState === null) return null;
    const refIdx = visibleRows.indexOf(inspectedRowState.row);
    if (refIdx >= 0) return refIdx;
    let matchedOccurrence = 0;
    for (let idx = 0; idx < visibleRowKeys.length; idx += 1) {
      if (visibleRowKeys[idx] === inspectedRowState.key) {
        if (matchedOccurrence === inspectedRowState.occurrence) return idx;
        matchedOccurrence += 1;
      }
    }
    return null;
  }, [inspectedRowState, visibleRows, visibleRowKeys]);

  useEffect(() => {
    if (inspectedRowState !== null && selectedRowIndex === null) setInspectedRowState(null);
  }, [inspectedRowState, selectedRowIndex]);

  const handleRowClick = useCallback(
    (row: unknown[], rowIndex: number) => {
      setInspectedRowState(createInspectedRowState(visibleRows, row, rowIndex));
    },
    [visibleRows],
  );

  const handleCloseInspector = useCallback(() => setInspectedRowState(null), []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (inspectedRowState === null || selectedRowIndex === null) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const target = event.target as HTMLElement | null;
      if (!target?.closest("tr[data-row-index]")) return;
      if (visibleRows.length === 0) return;
      const maxIndex = visibleRows.length - 1;
      const currentIndex = Math.min(Math.max(selectedRowIndex, 0), maxIndex);
      event.preventDefault();

      const nextIndex =
        event.key === "ArrowDown"
          ? Math.min(currentIndex + 1, maxIndex)
          : Math.max(currentIndex - 1, 0);
      if (nextIndex === currentIndex) return;

      const nextRow = visibleRows[nextIndex];
      if (nextRow) {
        setInspectedRowState(createInspectedRowState(visibleRows, nextRow, nextIndex));
        const rowEl = tableContainerRef.current?.querySelector(`[data-row-index="${nextIndex}"]`);
        if (rowEl && typeof rowEl.scrollIntoView === "function") {
          rowEl.scrollIntoView({ block: "nearest" });
        }
      }
    },
    [inspectedRowState, selectedRowIndex, visibleRows],
  );

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

  return {
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    inspectedRowState,
    showEmptyColumns,
    setShowEmptyColumns,
    tableContainerRef,
    menuAnchor,
    setMenuAnchor,
    menuColumnIndex,
    setMenuColumnIndex,
    pinnedColumns,
    emptyColumnIndices,
    orderedVisibleColumnIndices,
    pinnedLeftOffsets,
    visibleRows,
    rowSummaries,
    observeSummaryRow,
    unobserveSummaryRow,
    selectedRowIndex,
    handleRowClick,
    handleCloseInspector,
    handleKeyDown,
    handleSortToggle,
    moveColumn,
    closeMenu,
    handlePinColumn,
    handleUnpinColumn,
  };
}
