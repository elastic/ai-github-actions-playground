/**
 * Parsing utilities for host time-series ES|QL responses.
 */

import type { EsqlResponse } from "../../types";
import { buildColumnLookup, getColumnIndex, getRowValue } from "../../services/es/columnUtils";

export interface TimeSeriesPoint {
  bucket: string;
  value: number;
}

export function parseSimpleTimeSeries(data: EsqlResponse | null): TimeSeriesPoint[] {
  if (!data?.columns || !data.values) return [];
  const lookup = buildColumnLookup(data.columns);
  const bucketIdx = getColumnIndex(lookup, "bucket");
  const valueIdx = getColumnIndex(lookup, "metric_value");
  if (bucketIdx < 0 || valueIdx < 0) return [];

  return data.values
    .map((row) => ({
      bucket: String(getRowValue(row, bucketIdx) ?? ""),
      value:
        typeof getRowValue(row, valueIdx) === "number" ? (getRowValue(row, valueIdx) as number) : 0,
    }))
    .filter((p) => p.bucket);
}

export interface LoadAvgPoint {
  bucket: string;
  load1m: number;
  load5m: number;
  load15m: number;
}

export function parseLoadAverageSeries(data: EsqlResponse | null): LoadAvgPoint[] {
  if (!data?.columns || !data.values) return [];
  const lookup = buildColumnLookup(data.columns);
  const bucketIdx = getColumnIndex(lookup, "bucket");
  const l1Idx = getColumnIndex(lookup, "load_1m");
  const l5Idx = getColumnIndex(lookup, "load_5m");
  const l15Idx = getColumnIndex(lookup, "load_15m");
  if (bucketIdx < 0) return [];

  return data.values
    .map((row) => ({
      bucket: String(getRowValue(row, bucketIdx) ?? ""),
      load1m: typeof getRowValue(row, l1Idx) === "number" ? (getRowValue(row, l1Idx) as number) : 0,
      load5m: typeof getRowValue(row, l5Idx) === "number" ? (getRowValue(row, l5Idx) as number) : 0,
      load15m:
        typeof getRowValue(row, l15Idx) === "number" ? (getRowValue(row, l15Idx) as number) : 0,
    }))
    .filter((p) => p.bucket);
}
