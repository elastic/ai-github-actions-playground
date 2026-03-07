/**
 * Parsing utilities for host time-series ES|QL responses.
 */

import type { EsqlResponse } from "../../types";

export interface TimeSeriesPoint {
  bucket: string;
  value: number;
}

export function parseSimpleTimeSeries(data: EsqlResponse | null): TimeSeriesPoint[] {
  if (!data?.columns || !data.values) return [];
  const bucketIdx = data.columns.findIndex((c) => c.name === "bucket");
  const valueIdx = data.columns.findIndex((c) => c.name === "metric_value");
  if (bucketIdx < 0 || valueIdx < 0) return [];

  return data.values
    .map((row) => ({
      bucket: String(row[bucketIdx] ?? ""),
      value: typeof row[valueIdx] === "number" ? (row[valueIdx] as number) : 0,
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
  const bucketIdx = data.columns.findIndex((c) => c.name === "bucket");
  const l1Idx = data.columns.findIndex((c) => c.name === "load_1m");
  const l5Idx = data.columns.findIndex((c) => c.name === "load_5m");
  const l15Idx = data.columns.findIndex((c) => c.name === "load_15m");
  if (bucketIdx < 0) return [];

  return data.values
    .map((row) => ({
      bucket: String(row[bucketIdx] ?? ""),
      load1m: typeof row[l1Idx] === "number" ? (row[l1Idx] as number) : 0,
      load5m: typeof row[l5Idx] === "number" ? (row[l5Idx] as number) : 0,
      load15m: typeof row[l15Idx] === "number" ? (row[l15Idx] as number) : 0,
    }))
    .filter((p) => p.bucket);
}
