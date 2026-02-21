import type { EsqlColumn, EsqlResponse } from "../../types";

const DATE_TYPES = new Set(["date", "datetime", "date_nanos"]);
const TIMESTAMP_FIELD = "@timestamp";
const NUMERIC_TYPES = new Set([
  "long",
  "integer",
  "short",
  "byte",
  "double",
  "float",
  "half_float",
  "scaled_float",
  "unsigned_long",
  "counter_long",
  "counter_integer",
  "counter_double",
]);

export function isDateColumn(column: EsqlColumn): boolean {
  return DATE_TYPES.has(column.type) || column.name === TIMESTAMP_FIELD;
}

export function findDateColumnIndex(data: EsqlResponse): number {
  return data.columns.findIndex(isDateColumn);
}

export function findNumericColumnIndices(data: EsqlResponse): number[] {
  return data.columns.map((c, i) => (NUMERIC_TYPES.has(c.type) ? i : -1)).filter((i) => i >= 0);
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

export function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  if (Number.isInteger(num)) return num.toLocaleString();
  return num.toFixed(2);
}
