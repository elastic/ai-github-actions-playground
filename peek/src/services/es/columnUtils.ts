import type { EsqlColumn, EsqlResponse } from "../../types";

import { DATE_TYPES, NUMERIC_TYPES, STRING_TYPES } from "./esFieldTypes";

const TIMESTAMP_FIELD = "@timestamp";

export function isDateColumn(column: EsqlColumn): boolean {
  return DATE_TYPES.has(column.type) || column.name === TIMESTAMP_FIELD;
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
