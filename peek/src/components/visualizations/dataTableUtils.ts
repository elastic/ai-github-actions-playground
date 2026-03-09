export type SortDirection = "asc" | "desc";

export interface SortState {
  columnName: string;
  direction: SortDirection;
}

export const PINNED_COLUMN_MIN_WIDTH = 120;
export const CELL_TRUNCATE_LENGTH = 200;

export function reconcileColumnOrder(order: number[], allIndices: number[]): number[] {
  const allSet = new Set(allIndices);
  const kept = order.filter((i) => allSet.has(i));
  const keptSet = new Set(kept);
  const missing = allIndices.filter((i) => !keptSet.has(i));
  return [...kept, ...missing];
}

// ---------------------------------------------------------------------------
// Row-inspection helpers (used by DataTable to track which row is selected
// in the inspector flyout, including duplicate-row disambiguation).
// ---------------------------------------------------------------------------

export interface InspectedRowState {
  row: unknown[];
  key: string;
  occurrence: number;
}

export function getRowOccurrence(
  rows: unknown[][],
  targetKey: string,
  targetIndex: number,
): number {
  let occurrence = 0;
  for (let i = 0; i <= targetIndex; i += 1) {
    const row = rows[i];
    if (row && JSON.stringify(row) === targetKey) {
      occurrence += 1;
    }
  }
  return Math.max(occurrence - 1, 0);
}

export function createInspectedRowState(
  rows: unknown[][],
  row: unknown[],
  rowIndex: number,
): InspectedRowState {
  const key = JSON.stringify(row);
  return {
    row,
    key,
    occurrence: getRowOccurrence(rows, key, rowIndex),
  };
}
