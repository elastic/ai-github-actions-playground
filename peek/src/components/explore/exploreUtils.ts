import { parseAsString, parseAsStringEnum } from "nuqs";
import { z } from "zod";

import type { AggregationType, ExplorerFilter } from "../../services/es";
import { EXPLORER_AGGREGATIONS } from "../../services/es";

const FILTER_OPS = ["==", "!=", "LIKE"] as const;
const VALID_FILTER_OPS = new Set<ExplorerFilter["op"]>(FILTER_OPS);
export const HIDDEN_DIMENSION_FIELDS: ReadonlySet<string> = new Set([
  "_metrics_name_hash",
  "_metrics_names_hash",
]);

/**
 * Namespace hidden from the metric explorer UI (the top-level "metrics"
 * namespace is an implementation detail, not a user-facing category).
 */
export const HIDDEN_NAMESPACE = "metrics";

const ExplorerFilterSchema = z.object({
  field: z.string(),
  op: z.enum(FILTER_OPS),
  value: z.string(),
});

const parseAggregation = parseAsStringEnum<AggregationType>([...EXPLORER_AGGREGATIONS]);

export const explorerSearchParsers = {
  indexPattern: parseAsString,
  selectedMetric: parseAsString,
  aggregation: parseAggregation,
  groupBy: parseAsString,
  from: parseAsString,
  to: parseAsString,
};

export const exploreSearchUrlKeys = {
  indexPattern: "index",
  selectedMetric: "metric",
  aggregation: "agg",
};

function isExplorerFilterOp(value: string): value is ExplorerFilter["op"] {
  return VALID_FILTER_OPS.has(value as ExplorerFilter["op"]);
}

export function parseLegacyFilters(search: string): ExplorerFilter[] {
  const params = new URLSearchParams(search);
  const parsedFilters: ExplorerFilter[] = [];
  for (const [key, value] of params.entries()) {
    if (!key.startsWith("filter.")) continue;
    const field = key.slice("filter.".length).trim();
    if (!field) continue;
    const colonIdx = value.indexOf(":");
    if (colonIdx <= 0) continue;
    const op = value.slice(0, colonIdx);
    if (!isExplorerFilterOp(op)) continue;
    parsedFilters.push({ field, op, value: value.slice(colonIdx + 1) });
  }
  return parsedFilters;
}

export function parseEncodedFilters(encodedFilters: string | null): ExplorerFilter[] {
  if (!encodedFilters) return [];
  try {
    const parsed = JSON.parse(encodedFilters);
    if (!Array.isArray(parsed)) return [];
    const validFilters: ExplorerFilter[] = [];
    for (const item of parsed) {
      const result = ExplorerFilterSchema.safeParse(item);
      if (!result.success) continue;
      const field = result.data.field.trim();
      if (!field) continue;
      validFilters.push({ field, op: result.data.op, value: result.data.value });
    }
    return validFilters;
  } catch {
    return [];
  }
}

export function encodeFilters(filters: ExplorerFilter[]): string {
  const validFilters: ExplorerFilter[] = [];
  for (const filter of filters) {
    const field = filter.field.trim();
    if (!field || !VALID_FILTER_OPS.has(filter.op)) continue;
    validFilters.push({ field, op: filter.op, value: filter.value });
  }
  return JSON.stringify(validFilters);
}

export function metricNamespaceOf(metricName: string): string {
  const dot = metricName.indexOf(".");
  if (dot > 0) return metricName.slice(0, dot);
  const underscore = metricName.indexOf("_");
  return underscore > 0 ? metricName.slice(0, underscore) : metricName;
}

export function isHiddenDimensionField(fieldName: string): boolean {
  return HIDDEN_DIMENSION_FIELDS.has(fieldName);
}
