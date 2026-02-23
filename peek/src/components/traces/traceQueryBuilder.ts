/**
 * Field mapping configuration for OTel trace data.
 * Centralizes field names so queries aren't brittle to schema differences
 * between EDOT, OTel Collector with Elastic exporter, and APM Server.
 */
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
  statusCode: "status",
  timestamp: "@timestamp",
  timestampUs: "attributes.timestamp.us",
  events: "events",
  index: "traces-*",
};

/** Escape a string value for use inside ES|QL double-quoted literals */
function escapeEsqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Validate an ES|QL identifier (field name) to prevent injection */
const SAFE_IDENTIFIER_RE = /^[A-Za-z_@][A-Za-z0-9_.@-]*$/;
function validateEsqlIdentifier(key: string): string {
  if (!SAFE_IDENTIFIER_RE.test(key)) {
    throw new Error(`Invalid field name: ${key}`);
  }
  return key;
}

/** Structured filters for trace search */
export interface TraceFilters {
  services: string[];
  operations: string[];
  statusCodes: string[];
  minDurationMs: number | null;
  maxDurationMs: number | null;
  tags: Array<{ key: string; value: string; exclude?: boolean }>;
}

export const EMPTY_FILTERS: TraceFilters = {
  services: [],
  operations: [],
  statusCodes: [],
  minDurationMs: null,
  maxDurationMs: null,
  tags: [],
};

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
    const serviceList = filters.services.map((s) => `"${escapeEsqlString(s)}"`).join(", ");
    whereClauses.push(`${fields.serviceName} IN (${serviceList})`);
  }

  if (filters.operations.length > 0) {
    const opList = filters.operations.map((o) => `"${escapeEsqlString(o)}"`).join(", ");
    whereClauses.push(`${fields.spanName} IN (${opList})`);
  }

  if (filters.statusCodes.length > 0) {
    const statusList = filters.statusCodes.map((s) => `"${escapeEsqlString(s)}"`).join(", ");
    whereClauses.push(`${fields.statusCode} IN (${statusList})`);
  }

  if (filters.minDurationMs !== null) {
    whereClauses.push(`${fields.durationUs} >= ${filters.minDurationMs * 1000}`);
  }

  if (filters.maxDurationMs !== null) {
    whereClauses.push(`${fields.durationUs} <= ${filters.maxDurationMs * 1000}`);
  }

  for (const tag of filters.tags) {
    const validatedKey = validateEsqlIdentifier(tag.key);
    if (tag.exclude) {
      whereClauses.push(`${validatedKey} != "${escapeEsqlString(tag.value)}"`);
    } else {
      whereClauses.push(`${validatedKey} == "${escapeEsqlString(tag.value)}"`);
    }
  }

  if (whereClauses.length > 0) {
    parts.push(`WHERE ${whereClauses.join(" AND ")}`);
  }

  return {
    body: parts.join(" | "),
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
  return [body, sort, limit].join(" | ");
}

/**
 * Generates an ES|QL query to fetch all spans for a specific trace.
 */
export function buildTraceDetailQuery(
  traceId: string,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  return `FROM ${fields.index} | WHERE ${fields.traceId} == "${escapeEsqlString(traceId)}" | LIMIT 10000`;
}

/**
 * Generates an ES|QL query for the trace timeseries aggregation view.
 */
export function buildTraceTimeseriesQuery(
  filters: TraceFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
): string {
  const { body } = buildTraceSearchQueryParts(filters, fields, {
    limit: 10000,
    rootSpansOnly: true,
  });
  return `${body} | EVAL duration_ms = ${fields.durationUs} / 1000.0 | STATS request_count = COUNT(*), avg_latency_ms = AVG(duration_ms), p95_latency_ms = PERCENTILE(duration_ms, 95) BY BUCKET(${fields.timestamp}, 50)`;
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
  const base = `FROM ${fields.index}`;
  const where = serviceName
    ? ` | WHERE ${fields.serviceName} == "${escapeEsqlString(serviceName)}"`
    : "";
  return `${base}${where} | STATS count = COUNT(*) BY ${fields.spanName} | SORT count DESC | LIMIT 50`;
}
