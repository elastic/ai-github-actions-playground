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
  statusCode: string;
  timestamp: string;
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
  durationUs: "duration",
  statusCode: "status",
  timestamp: "@timestamp",
  index: "traces-*",
};

/** Escape a string value for use inside ES|QL double-quoted literals */
function escapeEsqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

/**
 * Generates an ES|QL query from structured trace filters.
 * Targets root spans by default (parent.id IS NULL).
 */
export function buildTraceSearchQuery(
  filters: TraceFilters,
  fields: TraceFieldMapping = DEFAULT_FIELD_MAPPING,
  options: { limit?: number; rootSpansOnly?: boolean } = {},
): string {
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
    if (tag.exclude) {
      whereClauses.push(`${tag.key} != "${escapeEsqlString(tag.value)}"`);
    } else {
      whereClauses.push(`${tag.key} == "${escapeEsqlString(tag.value)}"`);
    }
  }

  if (whereClauses.length > 0) {
    parts.push(`WHERE ${whereClauses.join(" AND ")}`);
  }

  parts.push(`SORT ${fields.timestamp} DESC`);
  parts.push(`LIMIT ${limit}`);

  return parts.join(" | ");
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
  const baseQuery = buildTraceSearchQuery(filters, fields, { limit: 10000, rootSpansOnly: true });
  // Remove the SORT and LIMIT from the base query, add aggregation
  const withoutSortLimit = baseQuery.replace(/ ?\| SORT [^|]+/, "").replace(/ ?\| LIMIT \d+/, "");
  return `${withoutSortLimit} | STATS count = COUNT(*) BY BUCKET(${fields.timestamp}, 50, "", "")`;
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
  const where = serviceName ? ` | WHERE ${fields.serviceName} == "${escapeEsqlString(serviceName)}"` : "";
  return `${base}${where} | STATS count = COUNT(*) BY ${fields.spanName} | SORT count DESC | LIMIT 50`;
}
