import type { EsqlResponse } from "../../types";
import { findDateColumnIndex } from "../../services/es/columnUtils";
import { formatChartAxisDate } from "../../utils/formatDate";

/** Extract a single metric column with the date column for charting */
export function sliceForMetric(data: EsqlResponse, metricColumn: string): EsqlResponse | null {
  const dateIdx = findDateColumnIndex(data);
  const metricIdx = data.columns.findIndex((c) => c.name === metricColumn);
  if (dateIdx < 0 || metricIdx < 0) return null;
  const dateCol = data.columns[dateIdx]!;
  const metricCol = data.columns[metricIdx]!;
  return {
    columns: [dateCol, metricCol],
    values: data.values.map((row) => [row[dateIdx] ?? null, row[metricIdx] ?? null]),
  };
}

export function parseTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  return null;
}

/** Extract time range from timeseries data when preset resolution fails. */
export function extractTimeRangeFromTimeseries(data: EsqlResponse): {
  min: number;
  max: number;
} | null {
  const dateIdx = findDateColumnIndex(data);
  if (dateIdx < 0 || data.values.length === 0) return null;
  const first = parseTimestampMs(data.values[0]?.[dateIdx]);
  const last = parseTimestampMs(data.values[data.values.length - 1]?.[dateIdx]);
  if (first == null || last == null) return null;
  const bucketWidth = data.values.length > 1 ? (last - first) / (data.values.length - 1) : 0;
  return { min: first, max: last + bucketWidth };
}

/** Transform timeseries (bucket, error_count) to BarChart format: categories = formatted dates, values = counts */
export function toErrorsBarData(data: EsqlResponse): EsqlResponse | null {
  const sliced = sliceForMetric(data, "error_count");
  if (!sliced || sliced.values.length === 0) return null;
  return {
    columns: [
      { name: "bucket", type: "keyword" },
      { name: "error_count", type: "long" },
    ],
    values: sliced.values.map((row) => [
      formatChartAxisDate(String(row[0] ?? "")),
      Number(row[1]) || 0,
    ]),
  };
}
