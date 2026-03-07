import {
  escapeEsqlString,
  validateEsqlIdentifier,
  validateEsqlIndexPattern,
} from "../../services/es/esqlUtils";
import { buildWherePipe } from "../../services/es/queryParts";
import { resolveDateTime } from "../../services/datemath";
import type { TimeRange } from "../../types/dashboard";

export interface LogsFilterChip {
  field: string;
  value: string;
  exclude?: boolean;
}

export interface LogsQueryState {
  indexPattern: string;
  searchText: string;
  filters: LogsFilterChip[];
  selectedColumns: string[];
  timeRange?: {
    amount: number;
    unit: "minute" | "hour" | "day";
  };
  limit?: number;
}

export const DEFAULT_LOGS_QUERY_STATE: LogsQueryState = {
  indexPattern: "logs-*",
  searchText: "",
  filters: [],
  selectedColumns: ["@timestamp", "log.level", "service.name", "message", "trace.id"],
};

function buildSearchClause(searchText: string): string | null {
  const trimmed = searchText.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    const phrase = trimmed.slice(1, -1).trim().replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    if (!phrase) return null;
    return `MATCH_PHRASE(message, "${escapeEsqlString(phrase)}")`;
  }
  return `message : "${escapeEsqlString(trimmed)}"`;
}

export function buildLogsQuery(state: LogsQueryState): string {
  const safeIndexPattern = validateEsqlIndexPattern(state.indexPattern);
  const configuredAmount = state.timeRange?.amount;
  const timeRangeAmount =
    typeof configuredAmount === "number" &&
    Number.isInteger(configuredAmount) &&
    configuredAmount > 0
      ? configuredAmount
      : 1;
  const timeRangeUnit = state.timeRange?.unit ?? "hour";
  const timeRangeSuffix = timeRangeAmount === 1 ? "" : "s";
  const whereClauses: string[] = [
    `@timestamp >= NOW() - ${timeRangeAmount} ${timeRangeUnit}${timeRangeSuffix}`,
  ];

  for (const filter of state.filters) {
    const trimmedValue = filter.value.trim();
    if (!trimmedValue) continue;
    const field = validateEsqlIdentifier(filter.field);
    if (trimmedValue === "*") {
      // Existence filter: match any document where the field has a value
      whereClauses.push(filter.exclude ? `${field} IS NULL` : `${field} IS NOT NULL`);
    } else {
      const value = escapeEsqlString(trimmedValue);
      whereClauses.push(
        filter.exclude ? `(${field} != "${value}" OR ${field} IS NULL)` : `${field} == "${value}"`,
      );
    }
  }

  const searchClause = buildSearchClause(state.searchText);
  if (searchClause) {
    whereClauses.push(searchClause);
  }

  const keepColumns =
    state.selectedColumns.length > 0
      ? state.selectedColumns.map((name) => validateEsqlIdentifier(name)).join(", ")
      : "@timestamp, message";

  const configuredLimit = state.limit;
  const limit =
    typeof configuredLimit === "number" && Number.isInteger(configuredLimit) && configuredLimit > 0
      ? configuredLimit
      : 500;

  return [
    `FROM ${safeIndexPattern}`,
    buildWherePipe(whereClauses),
    "SORT @timestamp DESC",
    `KEEP ${keepColumns}`,
    `LIMIT ${limit}`,
  ]
    .filter(Boolean)
    .join(" | ");
}

export function appendPipeClause(query: string, clause: string): string {
  const trimmedQuery = query.trim();
  const trimmedClause = clause.trim();
  if (!trimmedQuery) return trimmedClause;
  if (!trimmedClause) return trimmedQuery;
  return `${trimmedQuery} | ${trimmedClause}`;
}

/**
 * Convert a `TimeRange` (date-math strings like "now-1h" / "now") to an
 * ES|QL WHERE filter on `@timestamp`.
 */
export function timeRangeToEsqlFilter(timeRange: TimeRange): string {
  const now = new Date();
  const resolve = (expr: string) => {
    const d = resolveDateTime(expr, now);
    return d ? d.toISOString() : expr;
  };
  return `@timestamp >= "${resolve(timeRange.from)}" AND @timestamp <= "${resolve(timeRange.to)}"`;
}
