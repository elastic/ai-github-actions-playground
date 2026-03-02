import type { TimeSeriesData } from "@perses-dev/core";

import { findNumericColumnIndices } from "../es/columnUtils";
import { DATE_TYPES } from "../es/esFieldTypes";
import type { EsqlColumn, EsqlResponse } from "../../types";

const TIMESTAMP_FIELD = "@timestamp";

export interface StatDataPoint {
  name: string;
  value: number | null;
}

export interface BarChartSeriesData {
  name: string;
  values: number[];
}

export interface BarChartData {
  categories: string[];
  series: BarChartSeriesData[];
}

export interface GaugeDataPoint {
  name: string;
  value: number;
  values: number[];
}

function isTimestampColumn(column: EsqlColumn): boolean {
  return column.name === TIMESTAMP_FIELD || DATE_TYPES.has(column.type);
}

function isDimensionColumn(column: EsqlColumn): boolean {
  return column.type === "keyword" || column.type === "text";
}

function parseTimestampMs(value: unknown, columnType?: string): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (columnType === "date_nanos") {
      return value / 1_000_000;
    }
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
    const timestamp = parseTimestampMs(row[timestampIndex], data.columns[timestampIndex]?.type);
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

    const parsedTimestamp =
      timestampIndex >= 0
        ? parseTimestampMs(row[timestampIndex], data.columns[timestampIndex]?.type)
        : undefined;
    const timestamp = parsedTimestamp ?? rowIndex;

    const hasLabels = dimensionColumns.length > 0;
    let labels: Record<string, string> | undefined;
    let labelText = "";
    let labelKey = "";

    if (hasLabels) {
      labels = Object.create(null) as Record<string, string>;
      const labelNamesInOrder: string[] = [];
      for (let d = 0; d < dimensionColumns.length; d++) {
        const colIdx = dimensionColumns[d];
        if (colIdx === undefined) continue;
        const name = data.columns[colIdx]?.name ?? `label_${colIdx}`;
        const value = String(row[colIdx] ?? "");
        if (!Object.hasOwn(labels, name)) {
          labelNamesInOrder.push(name);
        }
        labels[name] = value;
      }
      const labelParts: string[] = [];
      const keyParts: string[] = [];
      for (const name of labelNamesInOrder) {
        const value = labels[name] ?? "";
        labelParts.push(`${name}=${value}`);
        // Length-prefix names/values to avoid collisions from delimiter-like content.
        keyParts.push(`${name.length}:${name}${value.length}:${value}`);
      }
      labelText = ` (${labelParts.join(", ")})`;
      labelKey = keyParts.join("");
    }

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
        labels,
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

export function toBarChartData(data: EsqlResponse): BarChartData {
  const numericColumns = findNumericColumnIndices(data);
  if (numericColumns.length === 0) {
    return { categories: [], series: [] };
  }

  const dimensionColumns = findDimensionColumnIndices(data);
  const categoryIndex = dimensionColumns[0] ?? -1;
  const groupIndex = dimensionColumns.length >= 2 ? (dimensionColumns[1] ?? -1) : -1;

  const categories =
    categoryIndex >= 0
      ? data.values.map((row) => String(row?.[categoryIndex] ?? "(empty)"))
      : data.values.map((_, index) => String(index));

  if (groupIndex < 0) {
    return {
      categories,
      series: numericColumns.map((columnIndex) => ({
        name: data.columns[columnIndex]?.name ?? `value_${columnIndex}`,
        values: data.values.map((row) => {
          const numeric = Number(row?.[columnIndex] ?? 0);
          return Number.isFinite(numeric) ? numeric : 0;
        }),
      })),
    };
  }

  const uniqueCategories = [...new Set(categories)];
  const groupedRows = new Map<string, number[]>();
  for (let index = 0; index < data.values.length; index++) {
    const group = String(data.values[index]?.[groupIndex] ?? "(empty)");
    const rows = groupedRows.get(group);
    if (rows) {
      rows.push(index);
    } else {
      groupedRows.set(group, [index]);
    }
  }

  const series: BarChartSeriesData[] = [];
  for (const groupName of Array.from(groupedRows.keys()).sort((a, b) => a.localeCompare(b))) {
    const rows = groupedRows.get(groupName) ?? [];
    for (const columnIndex of numericColumns) {
      const columnName = data.columns[columnIndex]?.name ?? `value_${columnIndex}`;
      const name = numericColumns.length > 1 ? `${columnName} (${groupName})` : groupName;
      series.push({
        name,
        values: uniqueCategories.map((category) =>
          rows.reduce((sum, rowIndex) => {
            if (categories[rowIndex] !== category) {
              return sum;
            }
            const numeric = Number(data.values[rowIndex]?.[columnIndex] ?? 0);
            return Number.isFinite(numeric) ? sum + numeric : sum;
          }, 0),
        ),
      });
    }
  }

  return { categories: uniqueCategories, series };
}

export function toGaugeData(data: EsqlResponse): GaugeDataPoint | undefined {
  const numericColumns = findNumericColumnIndices(data);
  if (numericColumns.length === 0 || data.values.length === 0) {
    return undefined;
  }

  const valueColumn = numericColumns[0];
  if (valueColumn === undefined) {
    return undefined;
  }
  const latestRowIndex = findLatestRowIndex(data, findTimestampColumnIndex(data));
  const latestRow = data.values[latestRowIndex];
  if (!latestRow) {
    return undefined;
  }

  const value = Number(latestRow[valueColumn] ?? 0);
  return {
    name: data.columns[valueColumn]?.name ?? `value_${valueColumn}`,
    value: Number.isFinite(value) ? value : 0,
    values: data.values.map((row) => {
      const numeric = Number(row?.[valueColumn] ?? 0);
      return Number.isFinite(numeric) ? numeric : 0;
    }),
  };
}
