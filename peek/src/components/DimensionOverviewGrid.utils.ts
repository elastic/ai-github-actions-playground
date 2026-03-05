import type { EsqlResponse } from "../types";

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
  const dateIdx = data.columns.findIndex(
    (c) => c.type === "date" || c.type === "date_nanos" || c.name === "@timestamp",
  );
  const metricIdx = data.columns.findIndex((c) => c.name === "metric");
  const dimIdx = data.columns.findIndex((_, i) => i !== dateIdx && i !== metricIdx);

  const unique = new Set<string>();
  for (const row of data.values) {
    const dimVal = dimIdx >= 0 ? normalizeDimensionBucketLabel(row[dimIdx]) : "all";
    unique.add(dimVal);
  }
  return unique.size;
}
