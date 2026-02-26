import type {
  ProfilingTopFunctionsRequest,
  ProfilingFlamegraphRequest,
} from "../../services/es/client";
import { escapeEsqlString } from "../../services/es/esqlUtils";

export interface ProfilingFilters {
  executableName: string | null;
  threadName: string | null;
  serviceName: string | null;
  hostName: string | null;
  timeFrom: string;
  timeTo: string;
  limit: number;
}

export const EMPTY_FILTERS: ProfilingFilters = {
  executableName: null,
  threadName: null,
  serviceName: null,
  hostName: null,
  timeFrom: "NOW() - 1 hour",
  timeTo: "NOW()",
  limit: 100,
};

function quoteList(values: string[]): string {
  return values.map((value) => `"${escapeEsqlString(value)}"`).join(", ");
}

function buildProfilingWhereClause(filters: ProfilingFilters): string[] {
  const where: string[] = [`@timestamp >= ${filters.timeFrom}`, `@timestamp <= ${filters.timeTo}`];
  if (filters.executableName) {
    where.push(`process.executable.name == "${escapeEsqlString(filters.executableName)}"`);
  }
  if (filters.threadName) {
    where.push(`process.thread.name == "${escapeEsqlString(filters.threadName)}"`);
  }
  if (filters.serviceName) {
    where.push(`service.name == "${escapeEsqlString(filters.serviceName)}"`);
  }
  if (filters.hostName) {
    where.push(`host.name == "${escapeEsqlString(filters.hostName)}"`);
  }
  return where;
}

export function buildProfilingEventsQuery(filters: ProfilingFilters): string {
  const where = buildProfilingWhereClause(filters);
  return [
    "FROM profiling-events-all",
    `WHERE ${where.join(" AND ")}`,
    `LIMIT ${Math.max(1, Math.min(1000, filters.limit))}`,
  ].join(" | ");
}

export function buildStacktraceLookupQuery(ids: string[]): string {
  if (ids.length === 0) {
    return 'FROM profiling-stacktraces METADATA _id | WHERE _id IN ("")';
  }
  return `FROM profiling-stacktraces METADATA _id | WHERE _id IN (${quoteList(ids)})`;
}

export function buildStackframeLookupQuery(frameIds: string[]): string {
  if (frameIds.length === 0) {
    return 'FROM profiling-stackframes METADATA _id | WHERE _id IN ("")';
  }
  return `FROM profiling-stackframes METADATA _id | WHERE _id IN (${quoteList(frameIds)})`;
}

export function buildProfilingTimelineQuery(filters: ProfilingFilters): string {
  const where = buildProfilingWhereClause(filters);
  return [
    "FROM profiling-events-all",
    `WHERE ${where.join(" AND ")}`,
    `STATS count = SUM(Stacktrace.count) BY bucket = BUCKET(@timestamp, 50, ${filters.timeFrom}, ${filters.timeTo})`,
    "SORT bucket",
  ].join(" | ");
}

function normalizeRangeTimestamp(expr: string): string {
  const trimmed = expr.trim();
  if (trimmed.toUpperCase() === "NOW()") return "now";
  const dateMathMatch = trimmed.match(
    /^NOW\(\)\s*([+-])\s*(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)$/i,
  );
  if (dateMathMatch) {
    const [, operator, amount, rawUnit] = dateMathMatch;
    if (!rawUnit) return expr;
    const unit = {
      minute: "m",
      minutes: "m",
      hour: "h",
      hours: "h",
      day: "d",
      days: "d",
      week: "w",
      weeks: "w",
      month: "M",
      months: "M",
      year: "y",
      years: "y",
    }[rawUnit.toLowerCase()];
    if (unit) return `now${operator}${amount}${unit}`;
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return expr;
}

export function buildTopFunctionsRequest(filters: ProfilingFilters): ProfilingTopFunctionsRequest {
  const range = {
    range: {
      "@timestamp": {
        gte: normalizeRangeTimestamp(filters.timeFrom),
        lt: normalizeRangeTimestamp(filters.timeTo),
      },
    },
  };
  const request: ProfilingTopFunctionsRequest = {
    limit: Math.max(1, Math.min(1000, filters.limit)),
    query: { bool: { filter: [range] } },
  };
  if (filters.executableName) {
    request.query.bool.filter.push({
      term: { "process.executable.name": filters.executableName },
    });
  }
  if (filters.threadName) {
    request.query.bool.filter.push({
      term: { "process.thread.name": filters.threadName },
    });
  }
  if (filters.serviceName) {
    request.query.bool.filter.push({
      term: { "service.name": filters.serviceName },
    });
  }
  if (filters.hostName) {
    request.query.bool.filter.push({
      term: { "host.name": filters.hostName },
    });
  }
  return request;
}

export function buildFlamegraphRequest(filters: ProfilingFilters): ProfilingFlamegraphRequest {
  return {
    sample_size: Math.max(1, Math.min(100000, filters.limit * 100)),
    query: buildTopFunctionsRequest(filters).query,
  };
}
