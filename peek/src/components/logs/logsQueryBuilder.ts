import {
  escapeEsqlString,
  validateEsqlIdentifier,
  validateEsqlIndexPattern,
} from "../../services/es/esqlUtils";
import { buildWherePipe } from "../../services/es/queryParts";

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
    const phrase = trimmed.slice(1, -1).trim();
    if (!phrase) return null;
    return `MATCH_PHRASE(message, "${escapeEsqlString(phrase)}")`;
  }
  return `message : "${escapeEsqlString(trimmed)}"`;
}

export function buildLogsQuery(state: LogsQueryState): string {
  const safeIndexPattern = validateEsqlIndexPattern(state.indexPattern);
  const whereClauses: string[] = ["@timestamp >= NOW() - 1 hour"];

  for (const filter of state.filters) {
    const field = validateEsqlIdentifier(filter.field);
    const value = escapeEsqlString(filter.value);
    whereClauses.push(filter.exclude ? `${field} != "${value}"` : `${field} == "${value}"`);
  }

  const searchClause = buildSearchClause(state.searchText);
  if (searchClause) {
    whereClauses.push(searchClause);
  }

  const keepColumns =
    state.selectedColumns.length > 0
      ? state.selectedColumns.map((name) => validateEsqlIdentifier(name)).join(", ")
      : "@timestamp, message";

  return [
    `FROM ${safeIndexPattern}`,
    buildWherePipe(whereClauses),
    "SORT @timestamp DESC",
    `KEEP ${keepColumns}`,
    "LIMIT 500",
  ].join(" | ");
}
