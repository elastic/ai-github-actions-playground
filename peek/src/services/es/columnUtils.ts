import type { EsqlColumn, EsqlResponse } from "../../types";

import { DATE_TYPES, NUMERIC_TYPES, STRING_TYPES } from "./esFieldTypes";

const TIMESTAMP_FIELD = "@timestamp";

export function isDateColumn(column: EsqlColumn): boolean {
  return DATE_TYPES.has(column.type) || column.name === TIMESTAMP_FIELD;
}

export function buildColumnLookup(columns: ReadonlyArray<{ name: string }>): Map<string, number> {
  const lookup = new Map<string, number>();
  for (let i = 0; i < columns.length; i++) {
    lookup.set(columns[i]!.name, i);
  }
  return lookup;
}

export function getColumnIndex(lookup: Map<string, number>, ...aliases: string[]): number {
  for (const alias of aliases) {
    const index = lookup.get(alias);
    if (index != null) return index;
  }
  return -1;
}

export function getRowValue(row: unknown[], index: number): unknown {
  return index >= 0 && index < row.length ? row[index] : null;
}

/**
 * Builds a column-name → row-value accessor for an ES|QL response.
 * Creates the index once and returns a fast lookup function.
 *
 * @example
 * const get = buildColumnAccessor(result.columns);
 * const serviceName = get(row, "service.name");
 */
export function buildColumnAccessor(columns: EsqlResponse["columns"]) {
  const colIndex = buildColumnLookup(columns);
  return (row: unknown[], field: string): unknown => {
    const idx = colIndex.get(field);
    return idx !== undefined ? row[idx] : null;
  };
}

/**
 * Converts an unknown value to a finite number, returning `fallback` for
 * NaN, Infinity, null, undefined, or non-numeric strings.
 */
export function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function findDateColumnIndex(data: EsqlResponse): number {
  return data.columns.findIndex(isDateColumn);
}

export function findStringColumnIndices(data: EsqlResponse): number[] {
  return data.columns
    .map((column, index) => (STRING_TYPES.has(column.type) ? index : -1))
    .filter((index) => index >= 0);
}

export function findNumericColumnIndices(data: EsqlResponse): number[] {
  return data.columns
    .map((column, index) => (NUMERIC_TYPES.has(column.type) ? index : -1))
    .filter((index) => index >= 0);
}
