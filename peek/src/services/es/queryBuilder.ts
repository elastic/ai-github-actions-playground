import type { TimeRange } from "../../types";

// ---------------------------------------------------------------------------
// Explorer query types
// ---------------------------------------------------------------------------

export type MetricType = "gauge" | "counter";

export type AggregationType = "avg" | "sum" | "min" | "max" | "count" | "p50" | "p95" | "p99";

export interface ExplorerFilter {
  field: string;
  op: "==" | "!=" | "LIKE";
  value: string;
}

export interface ExplorerQuery {
  indexPattern: string;
  metricField: string;
  metricType: MetricType;
  aggregation: AggregationType;
  filters: ExplorerFilter[];
  groupBy?: string;
  timeRange: TimeRange;
  bucketCount?: number;
}

export interface ExplorerQueryResult {
  esql: string;
  yAxisLabel: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_BUCKET_COUNT = 50;

const GAUGE_AGGREGATIONS: AggregationType[] = [
  "avg",
  "sum",
  "min",
  "max",
  "count",
  "p50",
  "p95",
  "p99",
];
const COUNTER_AGGREGATIONS: AggregationType[] = ["count"];

export function getDefaultAggregation(metricType: MetricType): AggregationType {
  return metricType === "counter" ? "count" : "avg";
}

export function getAggregationOptions(metricType: MetricType): AggregationType[] {
  return metricType === "counter" ? COUNTER_AGGREGATIONS : GAUGE_AGGREGATIONS;
}

// ---------------------------------------------------------------------------
// Query builder — pure function, no side effects
// ---------------------------------------------------------------------------

function escapeEsqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeEsqlIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

function buildFilterClause(filters: ExplorerFilter[]): string {
  if (filters.length === 0) return "";
  const conditions = filters.map((f) => {
    const escapedField = escapeEsqlIdentifier(f.field);
    const escaped = escapeEsqlString(f.value);
    if (f.op === "LIKE") {
      return `${escapedField} LIKE "${escaped}"`;
    }
    return `${escapedField} ${f.op} "${escaped}"`;
  });
  return conditions.join(" AND ");
}

function buildAggExpression(aggregation: AggregationType, field: string): string {
  const escapedField = escapeEsqlIdentifier(field);
  switch (aggregation) {
    case "avg":
      return `AVG(${escapedField})`;
    case "sum":
      return `SUM(${escapedField})`;
    case "min":
      return `MIN(${escapedField})`;
    case "max":
      return `MAX(${escapedField})`;
    case "count":
      return `COUNT(${escapedField})`;
    case "p50":
      return `PERCENTILE(${escapedField}, 50)`;
    case "p95":
      return `PERCENTILE(${escapedField}, 95)`;
    case "p99":
      return `PERCENTILE(${escapedField}, 99)`;
  }
}

function buildYAxisLabel(aggregation: AggregationType, metricField: string): string {
  const fieldName = metricField.split(".").pop() ?? metricField;
  const aggLabels: Record<AggregationType, string> = {
    avg: "Avg",
    sum: "Sum",
    min: "Min",
    max: "Max",
    count: "Count",
    p50: "p50",
    p95: "p95",
    p99: "p99",
  };
  return `${aggLabels[aggregation]} ${fieldName}`;
}

// ---------------------------------------------------------------------------
// Overview query — lightweight per-metric sparkline for the namespace grid
// ---------------------------------------------------------------------------

export interface OverviewQuery {
  indexPattern: string;
  metricField: string;
  metricType: MetricType;
  timeRange: TimeRange;
  bucketCount?: number;
}

const OVERVIEW_BUCKET_COUNT = 20;

export function buildOverviewQuery(q: OverviewQuery): ExplorerQueryResult {
  const buckets = q.bucketCount ?? OVERVIEW_BUCKET_COUNT;
  const agg = getDefaultAggregation(q.metricType);
  const aggExpr = buildAggExpression(agg, q.metricField);
  const parts: string[] = [
    `FROM ${q.indexPattern}`,
    `WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend`,
    `STATS metric = ${aggExpr} BY timestamp = BUCKET(@timestamp, ${buckets}, ?_tstart, ?_tend)`,
    `SORT timestamp`,
  ];
  const esql = parts.join(" | ");
  const yAxisLabel = buildYAxisLabel(agg, q.metricField);
  return { esql, yAxisLabel };
}

// ---------------------------------------------------------------------------
// Dimension overview query — per-dimension sparkline grouped by dimension value
// ---------------------------------------------------------------------------

export interface DimensionOverviewQuery {
  indexPattern: string;
  metricField: string;
  metricType: MetricType;
  dimensionField: string;
  timeRange: TimeRange;
  bucketCount?: number;
}

export function buildDimensionOverviewQuery(q: DimensionOverviewQuery): ExplorerQueryResult {
  const buckets = q.bucketCount ?? OVERVIEW_BUCKET_COUNT;
  const agg = getDefaultAggregation(q.metricType);
  const aggExpr = buildAggExpression(agg, q.metricField);
  const escapedDim = escapeEsqlIdentifier(q.dimensionField);
  const parts: string[] = [
    `FROM ${q.indexPattern}`,
    `WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend`,
    `STATS metric = ${aggExpr} BY timestamp = BUCKET(@timestamp, ${buckets}, ?_tstart, ?_tend), ${escapedDim}`,
    `SORT timestamp`,
  ];
  const esql = parts.join(" | ");
  const yAxisLabel = buildYAxisLabel(agg, q.metricField);
  return { esql, yAxisLabel };
}

// ---------------------------------------------------------------------------
// Full explorer query
// ---------------------------------------------------------------------------

export function buildExplorerQuery(q: ExplorerQuery): ExplorerQueryResult {
  const buckets = q.bucketCount ?? DEFAULT_BUCKET_COUNT;
  const parts: string[] = [];

  // FROM
  parts.push(`FROM ${q.indexPattern}`);

  // WHERE (filters + time range)
  const whereClauses: string[] = [];
  whereClauses.push("@timestamp >= ?_tstart AND @timestamp <= ?_tend");
  const filterClause = buildFilterClause(q.filters);
  if (filterClause) {
    whereClauses.push(filterClause);
  }
  parts.push(`WHERE ${whereClauses.join(" AND ")}`);

  // STATS ... BY BUCKET(...)
  const aggExpr = buildAggExpression(q.aggregation, q.metricField);
  const aggAlias = `metric`;
  const bucketExpr = `BUCKET(@timestamp, ${buckets}, ?_tstart, ?_tend)`;

  if (q.groupBy) {
    parts.push(
      `STATS ${aggAlias} = ${aggExpr} BY timestamp = ${bucketExpr}, ${escapeEsqlIdentifier(q.groupBy)}`,
    );
  } else {
    parts.push(`STATS ${aggAlias} = ${aggExpr} BY timestamp = ${bucketExpr}`);
  }

  // SORT
  parts.push("SORT timestamp");

  const esql = parts.join(" | ");
  const yAxisLabel = buildYAxisLabel(q.aggregation, q.metricField);

  return { esql, yAxisLabel };
}
