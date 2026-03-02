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
