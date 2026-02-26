import type { ElasticsearchClient } from "./client";
import { escapeEsqlIdentifier } from "./esqlUtils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldTopValue {
  value: string;
  count: number;
}

export interface FieldStats {
  fieldName: string;
  fieldType: string;
  /** Total document count in the stream. */
  totalCount: number;
  /** Documents where the field is not null. */
  nonNullCount: number;
  /** Percentage of documents where the field is null (0–100). */
  nullPercent: number;
  /** Approximate distinct value count (COUNT_DISTINCT). */
  cardinality: number;
  /** Top values by frequency — populated for keyword-like types. */
  topValues?: FieldTopValue[];
  /** Minimum value — populated for numeric and date types. */
  min?: string | number | null;
  /** Maximum value — populated for numeric and date types. */
  max?: string | number | null;
}

// ---------------------------------------------------------------------------
// Field type classification
// ---------------------------------------------------------------------------

const KEYWORD_LIKE_TYPES = new Set([
  "keyword",
  "constant_keyword",
  "wildcard",
  "text",
  "ip",
  "boolean",
  "version",
]);

const NUMERIC_TYPES = new Set([
  "integer",
  "long",
  "short",
  "byte",
  "double",
  "float",
  "half_float",
  "scaled_float",
  "unsigned_long",
  "counter_long",
  "counter_double",
  "counter_integer",
  "aggregate_metric_double",
]);

const DATE_TYPES = new Set(["date", "date_nanos"]);

export function isKeywordLikeType(type: string): boolean {
  return KEYWORD_LIKE_TYPES.has(type);
}

export function isNumericOrDateType(type: string): boolean {
  return NUMERIC_TYPES.has(type) || DATE_TYPES.has(type);
}

// ---------------------------------------------------------------------------
// Query builders (pure functions — no side effects)
// ---------------------------------------------------------------------------

/** Build the ES|QL query to fetch total count, non-null count, and cardinality for a field. */
export function buildFieldStatsQuery(indexPattern: string, field: string): string {
  const escapedField = escapeEsqlIdentifier(field);
  return (
    `FROM ${indexPattern} | ` +
    `STATS total = COUNT(*), non_null = COUNT(${escapedField}), ` +
    `cardinality = COUNT_DISTINCT(${escapedField})`
  );
}

/** Build the ES|QL query to fetch top values by frequency for a keyword-like field. */
export function buildTopValuesQuery(
  indexPattern: string,
  field: string,
  limit: number = 10,
): string {
  const escapedField = escapeEsqlIdentifier(field);
  return (
    `FROM ${indexPattern} | ` +
    `STATS count = COUNT(*) BY ${escapedField} | ` +
    `SORT count DESC | LIMIT ${limit}`
  );
}

/** Build the ES|QL query to fetch min and max for a numeric or date field. */
export function buildMinMaxQuery(indexPattern: string, field: string): string {
  const escapedField = escapeEsqlIdentifier(field);
  return (
    `FROM ${indexPattern} | ` +
    `STATS min_val = MIN(${escapedField}), max_val = MAX(${escapedField})`
  );
}

// ---------------------------------------------------------------------------
// Stats fetcher
// ---------------------------------------------------------------------------

/**
 * Fetch field-level statistics for a single field in a data stream.
 *
 * Runs up to two ES|QL queries:
 *  1. Counts query — total docs, non-null count, approximate cardinality.
 *  2. Type-specific query — top values (keyword-like) or min/max (numeric/date).
 */
export async function fetchFieldStats(
  client: ElasticsearchClient,
  indexPattern: string,
  fieldName: string,
  fieldType: string,
  signal?: AbortSignal,
): Promise<FieldStats> {
  const statsQuery = buildFieldStatsQuery(indexPattern, fieldName);
  const statsResp = await client.query({ query: statsQuery }, signal);

  const totalIdx = statsResp.columns.findIndex((c) => c.name === "total");
  const nonNullIdx = statsResp.columns.findIndex((c) => c.name === "non_null");
  const cardinalityIdx = statsResp.columns.findIndex((c) => c.name === "cardinality");

  const row = statsResp.values[0] ?? [];
  const totalCount = totalIdx >= 0 ? Number(row[totalIdx]) : 0;
  const nonNullCount = nonNullIdx >= 0 ? Number(row[nonNullIdx]) : 0;
  const cardinality = cardinalityIdx >= 0 ? Number(row[cardinalityIdx]) : 0;
  const nullPercent = totalCount > 0 ? ((totalCount - nonNullCount) / totalCount) * 100 : 0;

  const result: FieldStats = {
    fieldName,
    fieldType,
    totalCount,
    nonNullCount,
    nullPercent,
    cardinality,
  };

  if (isKeywordLikeType(fieldType)) {
    const topQuery = buildTopValuesQuery(indexPattern, fieldName);
    const topResp = await client.query({ query: topQuery }, signal);
    const countIdx = topResp.columns.findIndex((c) => c.name === "count");
    const fieldIdx = topResp.columns.findIndex((c) => c.name === fieldName);
    if (countIdx >= 0 && fieldIdx >= 0) {
      result.topValues = topResp.values
        .filter((r) => r[fieldIdx] != null)
        .map((r) => ({ value: String(r[fieldIdx]), count: Number(r[countIdx]) }));
    } else {
      result.topValues = [];
    }
  } else if (isNumericOrDateType(fieldType)) {
    const minMaxQuery = buildMinMaxQuery(indexPattern, fieldName);
    const minMaxResp = await client.query({ query: minMaxQuery }, signal);
    const minIdx = minMaxResp.columns.findIndex((c) => c.name === "min_val");
    const maxIdx = minMaxResp.columns.findIndex((c) => c.name === "max_val");
    const mmRow = minMaxResp.values[0] ?? [];
    result.min =
      minIdx >= 0 ? ((mmRow[minIdx] as string | number | null | undefined) ?? null) : null;
    result.max =
      maxIdx >= 0 ? ((mmRow[maxIdx] as string | number | null | undefined) ?? null) : null;
  }

  return result;
}
