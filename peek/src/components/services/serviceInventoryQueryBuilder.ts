/**
 * ES|QL query builders for the Service Inventory page.
 * Aggregates service-level metrics (throughput, latency, error rate) from OTel trace data.
 */
import { DEFAULT_FIELD_MAPPING, type TraceFieldMapping } from "../traces/traceQueryBuilder";
import { escapeEsqlString } from "../../services/es/esqlUtils";
import { buildWherePipe } from "../../services/es/queryParts";

export interface ServiceInventoryFilters {
  /** ES|QL date expression for the lower time bound, e.g. "NOW() - 1 hour" */
  timeFrom: string;
  /** ES|QL date expression for the upper time bound, e.g. "NOW()" */
  timeTo: string;
}

export const DEFAULT_SERVICE_INVENTORY_FILTERS: ServiceInventoryFilters = {
  timeFrom: "NOW() - 1 hour",
  timeTo: "NOW()",
};

/**
 * Builds an ES|QL query that aggregates per-service metrics from root spans.
 * Returns: service name, throughput/latency/error metrics plus investigative context.
 */
export function buildServiceInventoryQuery(
  filters: ServiceInventoryFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const whereClauses: string[] = [
    `${fields.parentSpanId} IS NULL`,
    `${fields.timestamp} >= ${filters.timeFrom}`,
    `${fields.timestamp} <= ${filters.timeTo}`,
  ];

  const durationExpr = `COALESCE(${fields.durationUs}, ${fields.durationNs} / 1000)`;

  return [
    `FROM ${fields.index}`,
    buildWherePipe(whereClauses),
    "EVAL duration_ms = " +
      `${durationExpr} / 1000.0, ` +
      `is_error = CASE(${fields.statusCode} == "ERROR", 1, 0), ` +
      "route_key = COALESCE(attributes.url.path, attributes.http.route, url.path, '/'), " +
      `span_name_key = COALESCE(${fields.spanName}, "unknown"), ` +
      "error_message_key = CASE(is_error == 1, COALESCE(status.message, attributes.error.message, span_name_key), NULL), " +
      "language_key = COALESCE(service.language.name, attributes.service.language, 'unknown'), " +
      "environment_key = COALESCE(service.environment, deployment.environment, 'unknown')",
    `STATS request_count = COUNT(*), avg_latency_ms = AVG(duration_ms), error_count = SUM(is_error), unique_routes = COUNT_DISTINCT(route_key), unique_span_names = COUNT_DISTINCT(span_name_key), top_route = TOP(route_key, 1, "desc"), top_span_name = TOP(span_name_key, 1, "desc"), top_error = TOP(error_message_key, 1, "desc"), language = TOP(language_key, 1, "desc"), environment = TOP(environment_key, 1, "desc") BY ${fields.serviceName}`,
    `EVAL error_rate = error_count / request_count`,
    `SORT request_count DESC`,
    `LIMIT 200`,
  ].join(" | ");
}

/**
 * Builds an ES|QL query that fetches the list of unique environments for a service.
 */
export function buildServiceEnvironmentsQuery(
  serviceName: string,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const where = buildWherePipe([`${fields.serviceName} == "${escapeEsqlString(serviceName)}"`]);
  return `FROM ${fields.index} | ${where} | STATS count = COUNT(*) BY service.environment | SORT count DESC | LIMIT 20`;
}
