/**
 * Field mapping configuration for OTel trace data.
 * Centralizes field names so queries aren't brittle to schema differences
 * between EDOT, OTel Collector with Elastic exporter, and APM Server.
 */
import { escapeEsqlString, validateEsqlIdentifier } from "../../services/es/esqlUtils";
import { buildPipeline, buildValueList, buildWherePipe } from "../../services/es/queryParts";

export interface TraceFieldMapping {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  serviceName: string;
  spanName: string;
  spanKind: string;
  durationUs: string;
  durationNs: string;
  statusCode: string;
  timestamp: string;
  timestampUs: string;
  serviceVersion: string;
  events: string;
  index: string;
}

/** Default field mapping for EDOT / Elastic OTel data */
export const DEFAULT_FIELD_MAPPING: TraceFieldMapping = {
  traceId: "trace.id",
  spanId: "span.id",
  parentSpanId: "parent.id",
  serviceName: "service.name",
  spanName: "name",
  spanKind: "kind",
  // EDOT stores raw `duration` in ns and `attributes.span.duration.us` in microseconds.
  durationUs: "attributes.span.duration.us",
  durationNs: "duration",
  statusCode: "status.code",
  timestamp: "@timestamp",
  timestampUs: "attributes.timestamp.us",
  serviceVersion: "service.version",
  events: "events",
  index: "traces-*",
};

/** Structured filters for trace search */
export interface TraceFilters {
  services: string[];
  operations: string[];
  statusCodes: string[];
  minDurationMs: number | null;
  maxDurationMs: number | null;
  tags: Array<{ key: string; value: string; exclude?: boolean }>;
  /** ES|QL date expression for the lower time bound, e.g. "NOW() - 1 hour" */
  timeFrom: string | null;
  /** ES|QL date expression for the upper time bound, e.g. "NOW()" */
  timeTo: string | null;
}

export const EMPTY_FILTERS: TraceFilters = {
  services: [],
  operations: [],
  statusCodes: [],
  minDurationMs: null,
  maxDurationMs: null,
  tags: [],
  timeFrom: null,
  timeTo: null,
};

function buildDurationUsExpression(fields: TraceFieldMapping): string {
  return `COALESCE(${fields.durationUs}, ${fields.durationNs} / 1000)`;
}

/** Structured query parts returned by buildTraceSearchQueryParts */
export interface TraceSearchQueryParts {
  body: string;
  sort: string;
  limit: string;
}

/**
 * Generates structured ES|QL query parts from trace filters.
 * Callers can use `body` alone (e.g. for aggregation) or join all parts.
 */
export function buildTraceSearchQueryParts(
  filters: TraceFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
  options: { limit?: number; rootSpansOnly?: boolean } = {},
): TraceSearchQueryParts {
  const { limit = 100, rootSpansOnly = true } = options;
  const parts: string[] = [`FROM ${fields.index}`];
  const whereClauses: string[] = [];

  if (rootSpansOnly) {
    whereClauses.push(`${fields.parentSpanId} IS NULL`);
  }

  if (filters.services.length > 0) {
    whereClauses.push(`${fields.serviceName} IN (${buildValueList(filters.services)})`);
  }

  if (filters.operations.length > 0) {
    whereClauses.push(`${fields.spanName} IN (${buildValueList(filters.operations)})`);
  }

  if (filters.statusCodes.length > 0) {
    whereClauses.push(`${fields.statusCode} IN (${buildValueList(filters.statusCodes)})`);
  }

  if (filters.minDurationMs !== null) {
    whereClauses.push(`${buildDurationUsExpression(fields)} >= ${filters.minDurationMs * 1000}`);
  }

  if (filters.maxDurationMs !== null) {
    whereClauses.push(`${buildDurationUsExpression(fields)} <= ${filters.maxDurationMs * 1000}`);
  }

  for (const tag of filters.tags) {
    const validatedKey = validateEsqlIdentifier(tag.key);
    if (tag.exclude) {
      whereClauses.push(`${validatedKey} != "${escapeEsqlString(tag.value)}"`);
    } else {
      whereClauses.push(`${validatedKey} == "${escapeEsqlString(tag.value)}"`);
    }
  }

  if (filters.timeFrom != null) {
    whereClauses.push(`${fields.timestamp} >= ${filters.timeFrom}`);
  }

  if (filters.timeTo != null) {
    whereClauses.push(`${fields.timestamp} <= ${filters.timeTo}`);
  }

  if (whereClauses.length > 0) {
    parts.push(buildWherePipe(whereClauses));
  }

  return {
    body: buildPipeline(parts),
    sort: `SORT ${fields.timestamp} DESC`,
    limit: `LIMIT ${limit}`,
  };
}

/**
 * Generates an ES|QL query from structured trace filters.
 * Targets root spans by default (parent.id IS NULL).
 */
export function buildTraceSearchQuery(
  filters: TraceFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
  options: { limit?: number; rootSpansOnly?: boolean } = {},
): string {
  const { body, sort, limit } = buildTraceSearchQueryParts(filters, fields, options);
  return buildPipeline([body, sort, limit]);
}

/**
 * Generates an ES|QL query to fetch all spans for a specific trace.
 */
export function buildTraceDetailQuery(
  traceId: string,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const where = buildWherePipe([`${fields.traceId} == "${escapeEsqlString(traceId)}"`]);
  return `FROM ${fields.index} | ${where} | LIMIT 10000`;
}

/**
 * Generates an ES|QL query to fetch spans for a list of trace IDs.
 */
export function buildTraceSpansForTraceIdsQuery(
  traceIds: string[],
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
  options: { limit?: number } = {},
): string {
  const validTraceIds = traceIds.filter((id) => id.trim().length > 0);
  if (validTraceIds.length === 0) {
    return `FROM ${fields.index} | LIMIT 0`;
  }
  const limit = options.limit ?? 20000;
  const where = buildWherePipe([`${fields.traceId} IN (${buildValueList(validTraceIds)})`]);
  return `FROM ${fields.index} | ${where} | SORT ${fields.timestamp} DESC | LIMIT ${limit}`;
}

export interface TraceQueryLabDraftContext {
  traceId: string;
  spanId?: string | null;
  timestamp?: string | null;
}

/**
 * Generates an ES|QL starter query for Query Lab from trace/span context.
 */
export function buildTraceQueryLabDraft(
  context: TraceQueryLabDraftContext,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const whereClauses = [`${fields.traceId} == "${escapeEsqlString(context.traceId)}"`];
  if (context.spanId) {
    whereClauses.push(`${fields.spanId} == "${escapeEsqlString(context.spanId)}"`);
  }
  if (context.timestamp) {
    whereClauses.push(`${fields.timestamp} == "${escapeEsqlString(context.timestamp)}"`);
  }
  return `FROM ${fields.index} | ${buildWherePipe(whereClauses)} | SORT ${fields.timestamp} DESC | LIMIT 200`;
}

/**
 * Generates an ES|QL query for the trace timeseries aggregation view.
 * Optionally accepts explicit `from` and `to` bounds for BUCKET.
 */
export function buildTraceTimeseriesQuery(
  filters: TraceFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
  options: { from?: string; to?: string } = {},
): string {
  const { from = filters.timeFrom ?? "NOW() - 1 day", to = filters.timeTo ?? "NOW()" } = options;
  const { body } = buildTraceSearchQueryParts(filters, fields, {
    limit: 10000,
    rootSpansOnly: true,
  });
  return `${body} | EVAL duration_ms = ${buildDurationUsExpression(fields)} / 1000.0 | STATS request_count = COUNT(*), avg_latency_ms = AVG(duration_ms), p95_latency_ms = PERCENTILE(duration_ms, 95) BY BUCKET(${fields.timestamp}, 50, ${from}, ${to})`;
}

/**
 * Generates an ES|QL query to fetch all spans (not just root spans) in the
 * current filter window for the Drift Radar aggregated service-map.
 * Client-side `buildServiceMapData` is used to compute the dependency graph.
 */
export function buildDriftRadarQuery(
  filters: TraceFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
  options: { limit?: number } = {},
): string {
  const { limit } = options;
  const { body } = buildTraceSearchQueryParts(filters, fields, {
    rootSpansOnly: false,
  });
  const limitClause = typeof limit === "number" ? ` | LIMIT ${limit}` : "";
  return `${body} | SORT ${fields.timestamp} DESC${limitClause}`;
}

/**
 * Shifts an ES|QL relative time range backward by one window duration so the
 * previous equal window can be used as a drift baseline.
 *
 * Supports the `"NOW() - N unit"` patterns produced by TRACE_TIME_RANGE_OPTIONS.
 * Returns `null` when the pattern cannot be parsed (e.g. absolute timestamps).
 *
 * @example
 *   shiftTimeRangeBack("NOW() - 1 hour", "NOW()")
 *   // → { timeFrom: "NOW() - 2 hour", timeTo: "NOW() - 1 hour" }
 */
export function shiftTimeRangeBack(
  timeFrom: string,
  timeTo: string,
): { timeFrom: string; timeTo: string } | null {
  if (timeTo.trim() !== "NOW()") return null;
  const match = timeFrom.trim().match(/^NOW\(\)\s*-\s*(\d+)\s+(\w+)$/);
  if (!match) return null;
  // match[1] and match[2] are always defined when the regex matches (groups 1 and 2 are required).
  const n = parseInt(match[1]!, 10);
  const unit = match[2]!;
  return {
    timeFrom: `NOW() - ${n * 2} ${unit}`,
    timeTo: timeFrom,
  };
}

/**
 * Generates an ES|QL query for service name value suggestions.
 */
export function buildServiceSuggestionsQuery(
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  return `FROM ${fields.index} | STATS count = COUNT(*) BY ${fields.serviceName} | SORT count DESC | LIMIT 50`;
}

/**
 * Generates an ES|QL query for operation name value suggestions.
 */
export function buildOperationSuggestionsQuery(
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
  serviceName?: string,
): string {
  const where = serviceName
    ? buildWherePipe([`${fields.serviceName} == "${escapeEsqlString(serviceName)}"`])
    : "";
  const wherePipe = where ? ` | ${where}` : "";
  return `FROM ${fields.index}${wherePipe} | STATS count = COUNT(*) BY ${fields.spanName} | SORT count DESC | LIMIT 50`;
}
