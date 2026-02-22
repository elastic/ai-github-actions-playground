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

const GAUGE_AGGREGATIONS: AggregationType[] = ["avg", "sum", "min", "max", "count"];
const COUNTER_AGGREGATIONS: AggregationType[] = ["sum", "avg", "min", "max", "count"];

export function getDefaultAggregation(metricType: MetricType): AggregationType {
  return metricType === "counter" ? "sum" : "avg";
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

function buildFilterClause(filters: ExplorerFilter[]): string {
  if (filters.length === 0) return "";
  const conditions = filters.map((f) => {
    const escaped = escapeEsqlString(f.value);
    if (f.op === "LIKE") {
      return `${f.field} LIKE "${escaped}"`;
    }
    return `${f.field} ${f.op} "${escaped}"`;
  });
  return conditions.join(" AND ");
}

function buildAggExpression(aggregation: AggregationType, field: string): string {
  switch (aggregation) {
    case "avg":
      return `AVG(${field})`;
    case "sum":
      return `SUM(${field})`;
    case "min":
      return `MIN(${field})`;
    case "max":
      return `MAX(${field})`;
    case "count":
      return `COUNT(${field})`;
    case "p50":
      return `PERCENTILE(${field}, 50)`;
    case "p95":
      return `PERCENTILE(${field}, 95)`;
    case "p99":
      return `PERCENTILE(${field}, 99)`;
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
    parts.push(`STATS ${aggAlias} = ${aggExpr} BY timestamp = ${bucketExpr}, ${q.groupBy}`);
  } else {
    parts.push(`STATS ${aggAlias} = ${aggExpr} BY timestamp = ${bucketExpr}`);
  }

  // SORT
  parts.push("SORT timestamp");

  const esql = parts.join(" | ");
  const yAxisLabel = buildYAxisLabel(q.aggregation, q.metricField);

  return { esql, yAxisLabel };
}
