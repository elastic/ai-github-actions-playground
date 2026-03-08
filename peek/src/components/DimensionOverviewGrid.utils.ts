import type { EsqlResponse } from "../types";
import {
  buildColumnLookup,
  findDateColumnIndex,
  getColumnIndex,
  getRowValue,
} from "../services/es/columnUtils";

export function normalizeDimensionBucketLabel(value: unknown): string {
  if (value == null) return "unknown";
  const label = String(value).trim();
  return label === "" || label === "-" ? "unknown" : label;
}

/**
 * Count the number of unique dimension values (series) in an overview query result.
 * Used to organize dimensions by cardinality: multi-series dimensions are typically
 * more interesting for exploration than single-series ones.
 */
export function getDimensionSeriesCount(data: EsqlResponse): number {
  const lookup = buildColumnLookup(data.columns);
  const dateIdx = findDateColumnIndex(data);
  const metricIdx = getColumnIndex(lookup, "metric");
  const dimIdx = data.columns.findIndex((_, i) => i !== dateIdx && i !== metricIdx);

  const unique = new Set<string>();
  for (const row of data.values) {
    const dimVal = dimIdx >= 0 ? normalizeDimensionBucketLabel(getRowValue(row, dimIdx)) : "all";
    unique.add(dimVal);
  }
  return unique.size;
}
