import type { EsqlColumn, EsqlResponse } from "../../types";
import { DATE_TYPES, NUMERIC_TYPES } from "../../services/es/esFieldTypes";
export { findNumericColumnIndices } from "../../services/es/columnUtils";

const TIMESTAMP_FIELD = "@timestamp";

export function isDateColumn(column: EsqlColumn): boolean {
  return DATE_TYPES.has(column.type) || column.name === TIMESTAMP_FIELD;
}

export function findDateColumnIndex(data: EsqlResponse): number {
  return data.columns.findIndex(isDateColumn);
}

export function findStringColumnIndices(data: EsqlResponse): number[] {
  return data.columns
    .map((c, i) => (c.type === "keyword" || c.type === "text" ? i : -1))
    .filter((i) => i >= 0);
}

export function getColumnValues(data: EsqlResponse, colIndex: number): unknown[] {
  return data.values.map((row) => row[colIndex]);
}

export function isDateType(type: string): boolean {
  return DATE_TYPES.has(type);
}

export function isNumericType(type: string): boolean {
  return NUMERIC_TYPES.has(type);
}

export interface SeriesDescriptor {
  name: string;
  colIdx: number;
  rows: number[];
}

/**
 * Build series descriptors that split data by a group column.
 *
 * When `groupIdx >= 0` each unique value in that column becomes its own
 * series.  With a single numeric column the series name is the group value;
 * with multiple numeric columns it is "colName (groupValue)".
 *
 * When there is no group column (`groupIdx < 0`) falls back to one series
 * per numeric column, named after the column.
 */
export function buildGroupedSeries(
  data: EsqlResponse,
  numericIdxs: number[],
  groupIdx: number,
): SeriesDescriptor[] {
  if (groupIdx < 0) {
    const allRows = Array.from({ length: data.values.length }, (_, i) => i);
    return numericIdxs.map((colIdx) => ({
      name: data.columns[colIdx]!.name,
      colIdx,
      rows: allRows,
    }));
  }

  const NULL_GROUP_KEY = Symbol("null-group");
  const groupedRows = new Map<unknown, number[]>();
  for (let i = 0; i < data.values.length; i++) {
    const groupValue = data.values[i]?.[groupIdx];
    const key = groupValue == null ? NULL_GROUP_KEY : groupValue;
    const rows = groupedRows.get(key);
    if (rows) {
      rows.push(i);
    } else {
      groupedRows.set(key, [i]);
    }
  }

  const result: SeriesDescriptor[] = [];
  for (const [groupValue, rows] of groupedRows) {
    const groupName = groupValue === NULL_GROUP_KEY ? "(empty)" : String(groupValue);
    for (const colIdx of numericIdxs) {
      const colName = data.columns[colIdx]!.name;
      const name = numericIdxs.length > 1 ? `${colName} (${groupName})` : groupName;
      result.push({ name, colIdx, rows });
    }
  }
  return result;
}

export function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  if (Number.isInteger(num)) return num.toLocaleString();
  return num.toFixed(2);
}
