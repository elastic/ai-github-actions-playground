// ---------------------------------------------------------------------------
// Shared Elasticsearch field-type classification sets
// ---------------------------------------------------------------------------

/**
 * Date-like field types that should be treated as temporal values.
 * `datetime` is included for compatibility with older index mappings.
 */
export const DATE_TYPES = new Set(["date", "datetime", "date_nanos"]);

/**
 * Numeric field types, including counter and pre-aggregated metric variants.
 */
export const NUMERIC_TYPES = new Set([
  "long",
  "integer",
  "short",
  "byte",
  "double",
  "float",
  "half_float",
  "scaled_float",
  "unsigned_long",
  "counter_long",
  "counter_integer",
  "counter_double",
  "aggregate_metric_double",
]);

/**
 * Keyword-like field types suitable for exact-match aggregations (top values, cardinality).
 */
export const KEYWORD_TYPES = new Set([
  "keyword",
  "constant_keyword",
  "wildcard",
  "text",
  "ip",
  "boolean",
  "version",
]);
