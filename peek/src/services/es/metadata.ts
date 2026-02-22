import type { ElasticsearchClient, EsqlColumn } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MetricTypeClassification = "gauge" | "counter" | "unknown";

export interface FieldInfo {
  name: string;
  type: string;
  metricType: MetricTypeClassification;
}

export interface FieldValueEntry {
  value: string;
  count: number;
}

function escapeEsqlIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

// ---------------------------------------------------------------------------
// Metric type classification
// ---------------------------------------------------------------------------

const COUNTER_TYPES = new Set(["counter_long", "counter_double", "counter_integer"]);
const GAUGE_TYPES = new Set([
  "long",
  "integer",
  "short",
  "byte",
  "double",
  "float",
  "half_float",
  "scaled_float",
  "unsigned_long",
]);

export function classifyMetricType(esqlType: string): MetricTypeClassification {
  if (COUNTER_TYPES.has(esqlType)) return "counter";
  if (GAUGE_TYPES.has(esqlType)) return "gauge";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Metadata queries (use the existing ElasticsearchClient.query method)
// ---------------------------------------------------------------------------

/**
 * Discover all fields for an index pattern by running `FROM {index} | LIMIT 0`.
 * Falls back to `LIMIT 1` if `LIMIT 0` returns no column metadata.
 */
export async function listFields(
  client: ElasticsearchClient,
  indexPattern: string,
  signal?: AbortSignal,
): Promise<FieldInfo[]> {
  // Try LIMIT 0 first — returns column metadata without data
  const response = await client.query({ query: `FROM ${indexPattern} | LIMIT 0` }, signal);
  let columns: EsqlColumn[] = response.columns;

  // Fall back to LIMIT 1 if LIMIT 0 returned no columns
  if (columns.length === 0) {
    const fallback = await client.query({ query: `FROM ${indexPattern} | LIMIT 1` }, signal);
    columns = fallback.columns;
  }

  return columns.map((col) => ({
    name: col.name,
    type: col.type,
    metricType: classifyMetricType(col.type),
  }));
}

/**
 * Get top-N values and their counts for a given field.
 * Useful for populating filter dropdowns.
 */
export async function getFieldValues(
  client: ElasticsearchClient,
  indexPattern: string,
  field: string,
  limit: number = 20,
  signal?: AbortSignal,
): Promise<FieldValueEntry[]> {
  const escapedField = escapeEsqlIdentifier(field);
  const query =
    `FROM ${indexPattern} | STATS count = COUNT(*) BY ${escapedField} | ` +
    `SORT count DESC | LIMIT ${limit}`;
  const response = await client.query({ query }, signal);

  // Expect two columns: count and the field
  const countIdx = response.columns.findIndex((c) => c.name === "count");
  const fieldIdx = response.columns.findIndex((c) => c.name === field || c.name === escapedField);

  if (countIdx < 0 || fieldIdx < 0) return [];

  return response.values
    .filter((row) => row[fieldIdx] != null)
    .map((row) => ({
      value: String(row[fieldIdx]),
      count: Number(row[countIdx]),
    }));
}

/**
 * Get approximate cardinality for one or more fields.
 * Returns a map of field name → distinct count.
 */
export async function getFieldCardinality(
  client: ElasticsearchClient,
  indexPattern: string,
  fields: string[],
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  if (fields.length === 0) return {};

  const statsExprs = fields
    .map((f) => `${escapeEsqlIdentifier(`${f}_card`)} = COUNT_DISTINCT(${escapeEsqlIdentifier(f)})`)
    .join(", ");
  const query = `FROM ${indexPattern} | STATS ${statsExprs}`;
  const response = await client.query({ query }, signal);

  const result: Record<string, number> = {};
  for (const field of fields) {
    const colIdx = response.columns.findIndex((c) => c.name === `${field}_card`);
    if (colIdx >= 0 && response.values.length > 0) {
      result[field] = Number(response.values[0][colIdx]);
    }
  }
  return result;
}
