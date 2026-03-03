import type { ProfilingTopFunctionsRequest } from "../../services/es/client";
import { escapeEsqlString } from "../../services/es/esqlUtils";
import {
  buildPipeline,
  buildValueList,
  buildWherePipe,
  normalizeTimeExpression,
} from "../../services/es/queryParts";

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

function normalizeEsqlDateTimeExpression(expr: string): string {
  return normalizeTimeExpression(expr) ?? expr;
}

function buildProfilingWhereClause(filters: ProfilingFilters): string[] {
  const timeFrom = normalizeEsqlDateTimeExpression(filters.timeFrom);
  const timeTo = normalizeEsqlDateTimeExpression(filters.timeTo);
  const where: string[] = [`@timestamp >= ${timeFrom}`, `@timestamp <= ${timeTo}`];
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
  return buildPipeline([
    "FROM profiling-events-all",
    buildWherePipe(where),
    `LIMIT ${Math.max(1, Math.min(1000, filters.limit))}`,
  ]);
}

export function buildProfilingFlamescopeQuery(filters: ProfilingFilters): string {
  const where = buildProfilingWhereClause(filters);
  return buildPipeline([
    "FROM profiling-events-all",
    buildWherePipe(where),
    "KEEP @timestamp, Stacktrace.id, Stacktrace.count, service.name, host.name",
    "SORT @timestamp ASC",
    `LIMIT ${Math.max(1, Math.min(5000, filters.limit * 20))}`,
  ]);
}

function buildLookupQuery(index: string, ids: string[]): string {
  if (ids.length === 0) {
    // Empty IDs should never return documents.
    return `FROM ${index} METADATA _id | WHERE 1 == 0`;
  }
  return `FROM ${index} METADATA _id | WHERE _id IN (${buildValueList(ids)})`;
}

export function buildStacktraceLookupQuery(ids: string[]): string {
  return buildLookupQuery("profiling-stacktraces", ids);
}

export function buildStackframeLookupQuery(frameIds: string[]): string {
  return buildLookupQuery("profiling-stackframes", frameIds);
}

export function buildProfilingTimelineQuery(filters: ProfilingFilters): string {
  const where = buildProfilingWhereClause(filters);
  const timeFrom = normalizeEsqlDateTimeExpression(filters.timeFrom);
  const timeTo = normalizeEsqlDateTimeExpression(filters.timeTo);
  return buildPipeline([
    "FROM profiling-events-all",
    buildWherePipe(where),
    `STATS count = SUM(Stacktrace.count) BY bucket = BUCKET(@timestamp, 50, ${timeFrom}, ${timeTo})`,
    "SORT bucket",
  ]);
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
