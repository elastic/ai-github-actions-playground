import type { TimeSeriesData } from "@perses-dev/core";

import { DATE_TYPES, NUMERIC_TYPES } from "../es/esFieldTypes";
import type { EsqlColumn, EsqlResponse } from "../../types";

const TIMESTAMP_FIELD = "@timestamp";

export interface StatDataPoint {
  name: string;
  value: number | null;
}

function isTimestampColumn(column: EsqlColumn): boolean {
  return column.name === TIMESTAMP_FIELD || DATE_TYPES.has(column.type);
}

function isDimensionColumn(column: EsqlColumn): boolean {
  return column.type === "keyword" || column.type === "text";
}

function parseTimestampMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizeNumericValue(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function findNumericColumnIndices(data: EsqlResponse): number[] {
  return data.columns
    .map((column, index) => (NUMERIC_TYPES.has(column.type) ? index : -1))
    .filter((index) => index >= 0);
}

function findTimestampColumnIndex(data: EsqlResponse): number {
  return data.columns.findIndex(isTimestampColumn);
}

function findDimensionColumnIndices(data: EsqlResponse): number[] {
  return data.columns
    .map((column, index) => (isDimensionColumn(column) ? index : -1))
    .filter((index) => index >= 0);
}

function findLatestRowIndex(data: EsqlResponse, timestampIndex: number): number {
  if (data.values.length === 0) {
    return -1;
  }
  if (timestampIndex < 0) {
    return data.values.length - 1;
  }

  let latestIndex = -1;
  let latestTimestamp = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < data.values.length; index++) {
    const row = data.values[index];
    if (!row) {
      continue;
    }
    const timestamp = parseTimestampMs(row[timestampIndex]);
    if (timestamp === undefined) {
      continue;
    }
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestIndex = index;
    }
  }

  return latestIndex >= 0 ? latestIndex : data.values.length - 1;
}

export function toTimeSeriesData(data: EsqlResponse): TimeSeriesData {
  const numericColumns = findNumericColumnIndices(data);
  if (numericColumns.length === 0) {
    return { series: [] };
  }

  const timestampIndex = findTimestampColumnIndex(data);
  const dimensionColumns = findDimensionColumnIndices(data);
  const seriesMap = new Map<
    string,
    { name: string; labels?: Record<string, string>; values: Array<[number, number | null]> }
  >();

  for (let rowIndex = 0; rowIndex < data.values.length; rowIndex++) {
    const row = data.values[rowIndex];
    if (!row) {
      continue;
    }

    const parsedTimestamp = timestampIndex >= 0 ? parseTimestampMs(row[timestampIndex]) : undefined;
    const timestamp = parsedTimestamp ?? rowIndex;

    const labels = Object.fromEntries(
      dimensionColumns.map((columnIndex) => [
        data.columns[columnIndex]?.name ?? `label_${columnIndex}`,
        String(row[columnIndex] ?? ""),
      ]),
    );
    const hasLabels = Object.keys(labels).length > 0;
    const labelText = hasLabels
      ? ` (${Object.entries(labels)
          .map(([name, value]) => `${name}=${value}`)
          .join(", ")})`
      : "";
    const labelKey = hasLabels
      ? Object.entries(labels)
          .map(([name, value]) => `${name}=${value}`)
          .join("|")
      : "";

    for (const numericColumnIndex of numericColumns) {
      const metricName = data.columns[numericColumnIndex]?.name ?? `value_${numericColumnIndex}`;
      const key = `${numericColumnIndex}::${labelKey}`;
      const existingSeries = seriesMap.get(key);
      if (existingSeries) {
        existingSeries.values.push([timestamp, normalizeNumericValue(row[numericColumnIndex])]);
        continue;
      }
      seriesMap.set(key, {
        name: `${metricName}${labelText}`,
        labels: hasLabels ? labels : undefined,
        values: [[timestamp, normalizeNumericValue(row[numericColumnIndex])]],
      });
    }
  }

  const series = Array.from(seriesMap.values()).map((entry) => ({
    ...entry,
    values: entry.values.sort((a, b) => a[0] - b[0]),
  }));
  return { series };
}

export function toStatData(data: EsqlResponse): StatDataPoint[] {
  const numericColumns = findNumericColumnIndices(data);
  if (numericColumns.length === 0 || data.values.length === 0) {
    return [];
  }

  const latestRowIndex = findLatestRowIndex(data, findTimestampColumnIndex(data));
  const latestRow = data.values[latestRowIndex];
  if (!latestRow) {
    return [];
  }

  return numericColumns.map((columnIndex) => ({
    name: data.columns[columnIndex]?.name ?? `value_${columnIndex}`,
    value: normalizeNumericValue(latestRow[columnIndex]),
  }));
}
