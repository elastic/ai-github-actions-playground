/**
 * ES|QL query builders for the Service Inventory page.
 * Aggregates service-level metrics (throughput, latency, error rate) from OTel trace data.
 */
import { DEFAULT_FIELD_MAPPING, type TraceFieldMapping } from "../traces/traceQueryBuilder";
import { escapeEsqlString } from "../../services/es/esqlUtils";
import {
  buildPipeline,
  buildWherePipe,
  normalizeTimeExpression,
} from "../../services/es/queryParts";
import {
  DEFAULT_SERVICE_INVENTORY_FILTERS,
  type ServiceInventoryFilters,
} from "../../types/pageFilters";

export type { ServiceInventoryFilters };
export { DEFAULT_SERVICE_INVENTORY_FILTERS };

function toSafeRelativeTimeExpression(value: string): string {
  const normalized = normalizeTimeExpression(value);
  if (normalized) return normalized;
  throw new Error(`Unsupported time expression: ${value}`);
}

/**
 * Builds an ES|QL query that aggregates per-service metrics from root spans.
 * Returns: service name, throughput/latency/error metrics plus investigative context.
 */
export function buildServiceInventoryQuery(
  filters: ServiceInventoryFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const safeTimeFrom = toSafeRelativeTimeExpression(filters.timeFrom);
  const safeTimeTo = toSafeRelativeTimeExpression(filters.timeTo);
  const whereClauses: string[] = [
    `${fields.parentSpanId} IS NULL`,
    `${fields.timestamp} >= ${safeTimeFrom}`,
    `${fields.timestamp} <= ${safeTimeTo}`,
  ];

  const durationExpr = `COALESCE(${fields.durationUs}, ${fields.durationNs} / 1000)`;

  return buildPipeline([
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    "EVAL duration_ms = " +
      `${durationExpr} / 1000.0, ` +
      `is_error = CASE(${fields.statusCode} IN ("Error", "STATUS_CODE_ERROR"), 1, 0), ` +
      'route_key = COALESCE(attributes.http.route, "/"), ' +
      `span_name_key = COALESCE(${fields.spanName}, "unknown"), ` +
      "error_message_key = CASE(is_error == 1, COALESCE(status.message, span_name_key), NULL), " +
      'language_key = COALESCE(service.language.name, "unknown"), ' +
      'environment_key = COALESCE(service.environment, deployment.environment, "unknown"), ' +
      `version_key = CASE(${fields.serviceVersion} IS NULL OR TRIM(${fields.serviceVersion}) == "", "unknown", ${fields.serviceVersion})`,
    // Note: TOP picks the most frequent version, not necessarily the latest by timestamp.
    // ES|QL lacks ARG_MAX; for precise latest-version tracking, see the Service Dashboard's
    // deployments panel which queries version history with timestamps.
    `STATS request_count = COUNT(*), avg_latency_ms = AVG(duration_ms), error_count = SUM(is_error), unique_routes = COUNT_DISTINCT(route_key), unique_span_names = COUNT_DISTINCT(span_name_key), top_route = TOP(route_key, 1, "desc"), top_span_name = TOP(span_name_key, 1, "desc"), top_error = TOP(error_message_key, 1, "desc"), language = TOP(language_key, 1, "desc"), environment = TOP(environment_key, 1, "desc"), version = TOP(version_key, 1, "desc"), unique_versions = COUNT_DISTINCT(version_key) BY ${fields.serviceName}`,
    `EVAL error_rate = error_count / request_count`,
    `SORT request_count DESC`,
    `LIMIT 200`,
  ]);
}

const SPARKLINE_BUCKETS = 20;

function parseRelativeRangeMinutes(timeFromExpr: string): number | null {
  const m = timeFromExpr.trim().match(/^NOW\(\)\s*-\s*(\d+)\s+(\w+)$/i);
  if (!m) return null;
  const amount = Number.parseInt(m[1] ?? "", 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = (m[2] ?? "").toLowerCase();
  if (unit.startsWith("minute")) return amount;
  if (unit.startsWith("hour")) return amount * 60;
  if (unit.startsWith("day")) return amount * 60 * 24;
  if (unit.startsWith("week")) return amount * 60 * 24 * 7;
  return null;
}

function sparklineIntervalForRange(timeFromExpr: string): string {
  const minutes = parseRelativeRangeMinutes(timeFromExpr);
  if (minutes === null) return "10 minutes";
  if (minutes <= 60) return "3 minutes";
  if (minutes <= 4 * 60) return "10 minutes";
  if (minutes <= 24 * 60) return "30 minutes";
  if (minutes <= 7 * 24 * 60) return "3 hours";
  return "12 hours";
}

/**
 * Builds an ES|QL query that returns time-bucketed per-service metrics for sparklines.
 * Produces ~SPARKLINE_BUCKETS data points per service for requests, latency, and error rate.
 */
export function buildServiceSparklineQuery(
  filters: ServiceInventoryFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
  serviceNames: string[] = [],
): string {
  const safeTimeFrom = toSafeRelativeTimeExpression(filters.timeFrom);
  const safeTimeTo = toSafeRelativeTimeExpression(filters.timeTo);
  const whereClauses: string[] = [
    `${fields.parentSpanId} IS NULL`,
    `${fields.timestamp} >= ${safeTimeFrom}`,
    `${fields.timestamp} <= ${safeTimeTo}`,
  ];
  if (serviceNames.length > 0) {
    const serviceInList = serviceNames.map((name) => `"${escapeEsqlString(name)}"`).join(", ");
    whereClauses.push(`${fields.serviceName} IN (${serviceInList})`);
  }

  const durationExpr = `COALESCE(${fields.durationUs}, ${fields.durationNs} / 1000)`;

  return buildPipeline([
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    `EVAL duration_ms = ${durationExpr} / 1000.0, ` +
      `is_error = CASE(${fields.statusCode} IN ("Error", "STATUS_CODE_ERROR"), 1, 0)`,
    `STATS request_count = COUNT(*), avg_latency_ms = AVG(duration_ms), error_count = SUM(is_error) BY ${fields.serviceName}, bucket = BUCKET(${fields.timestamp}, ${SPARKLINE_BUCKETS}, ${safeTimeFrom}, ${safeTimeTo})`,
    `EVAL error_rate = error_count / request_count`,
    `SORT bucket`,
  ]);
}

/**
 * Compatibility sparkline query that uses interval-based BUCKET() syntax
 * for clusters that do not support the 4-arg BUCKET variant.
 */
export function buildServiceSparklineIntervalQuery(
  filters: ServiceInventoryFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
  serviceNames: string[] = [],
): string {
  const safeTimeFrom = toSafeRelativeTimeExpression(filters.timeFrom);
  const safeTimeTo = toSafeRelativeTimeExpression(filters.timeTo);
  const whereClauses: string[] = [
    `${fields.parentSpanId} IS NULL`,
    `${fields.timestamp} >= ${safeTimeFrom}`,
    `${fields.timestamp} <= ${safeTimeTo}`,
  ];
  if (serviceNames.length > 0) {
    const serviceInList = serviceNames.map((name) => `"${escapeEsqlString(name)}"`).join(", ");
    whereClauses.push(`${fields.serviceName} IN (${serviceInList})`);
  }

  const durationExpr = `COALESCE(${fields.durationUs}, ${fields.durationNs} / 1000)`;
  const interval = sparklineIntervalForRange(safeTimeFrom);

  return buildPipeline([
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    `EVAL duration_ms = ${durationExpr} / 1000.0, ` +
      `is_error = CASE(${fields.statusCode} IN ("Error", "STATUS_CODE_ERROR"), 1, 0)`,
    `STATS request_count = COUNT(*), avg_latency_ms = AVG(duration_ms), error_count = SUM(is_error) BY ${fields.serviceName}, bucket = BUCKET(${fields.timestamp}, ${interval})`,
    `EVAL error_rate = error_count / request_count`,
    `SORT bucket`,
    `LIMIT 10000`,
  ]);
}

/**
 * Builds an ES|QL query that fetches the list of unique environments for a service.
 */
export function buildServiceEnvironmentsQuery(
  serviceName: string,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const where = buildWherePipe([`${fields.serviceName} == "${escapeEsqlString(serviceName)}"`]);
  return `FROM ${fields.index} | ${where} | EVAL environment_key = COALESCE(service.environment, deployment.environment, "unknown") | STATS count = COUNT(*) BY environment_key | SORT count DESC | LIMIT 20`;
}
