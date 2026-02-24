export interface ProfilingFieldMapping {
  index: string;
  timestamp: string;
  serviceName: string;
  hostName: string;
  functionName: string;
}

export const DEFAULT_PROFILING_FIELD_MAPPING: ProfilingFieldMapping = {
  index: "profiling-*",
  timestamp: "@timestamp",
  serviceName: "service.name",
  hostName: "host.name",
  functionName: "profiling.stacktrace.frame.function.name",
};

export interface ProfilingFilters {
  serviceName: string | null;
  hostName: string | null;
  functionName: string | null;
  from: string;
  to: string;
}

export const EMPTY_PROFILING_FILTERS: ProfilingFilters = {
  serviceName: null,
  hostName: null,
  functionName: null,
  from: "NOW() - 1 hour",
  to: "NOW()",
};

export type ProfilingViewMode = "hotspots" | "timeline";

function escapeEsqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function whereClauses(
  filters: ProfilingFilters,
  fields: ProfilingFieldMapping = DEFAULT_PROFILING_FIELD_MAPPING,
): string[] {
  const clauses = [
    `${fields.timestamp} >= ${filters.from}`,
    `${fields.timestamp} <= ${filters.to}`,
  ];
  if (filters.serviceName) {
    clauses.push(`${fields.serviceName} == "${escapeEsqlString(filters.serviceName)}"`);
  }
  if (filters.hostName) {
    clauses.push(`${fields.hostName} == "${escapeEsqlString(filters.hostName)}"`);
  }
  if (filters.functionName) {
    clauses.push(`${fields.functionName} == "${escapeEsqlString(filters.functionName)}"`);
  }
  return clauses;
}

export function buildProfilingHotspotsQuery(
  filters: ProfilingFilters,
  fields: ProfilingFieldMapping = DEFAULT_PROFILING_FIELD_MAPPING,
): string {
  return [
    `FROM ${fields.index}`,
    `WHERE ${whereClauses(filters, fields).join(" AND ")}`,
    `STATS samples = COUNT(*) BY ${fields.serviceName}, ${fields.hostName}, ${fields.functionName}`,
    "SORT samples DESC",
    "LIMIT 100",
  ].join(" | ");
}

export function buildProfilingTimelineQuery(
  filters: ProfilingFilters,
  fields: ProfilingFieldMapping = DEFAULT_PROFILING_FIELD_MAPPING,
): string {
  return [
    `FROM ${fields.index}`,
    `WHERE ${whereClauses(filters, fields).join(" AND ")}`,
    `STATS samples = COUNT(*) BY BUCKET(${fields.timestamp}, 40, ${filters.from}, ${filters.to}), ${fields.serviceName}`,
    `SORT ${fields.timestamp} ASC`,
    "LIMIT 2000",
  ].join(" | ");
}

export function buildProfilingQuery(
  viewMode: ProfilingViewMode,
  filters: ProfilingFilters,
  fields: ProfilingFieldMapping = DEFAULT_PROFILING_FIELD_MAPPING,
): string {
  if (viewMode === "timeline") {
    return buildProfilingTimelineQuery(filters, fields);
  }
  return buildProfilingHotspotsQuery(filters, fields);
}
