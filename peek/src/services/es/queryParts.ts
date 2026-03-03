import { escapeEsqlString } from "./esqlUtils";

/**
 * Shared ES|QL query-part helpers.
 *
 * Centralizes WHERE clause assembly so that all query modules use the same
 * formatting logic instead of duplicating `WHERE ${clauses.join(" AND ")}`.
 *
 * Time range models:
 * - `?_tstart` / `?_tend`: use in Perses dashboard panel queries driven by an external time picker.
 * - `NOW() - X` / `NOW()`: use in standalone page queries with local time controls.
 */

/**
 * Joins an array of condition strings with ` AND `.
 *
 * Returns an empty string when the array is empty.
 */
export function buildWhereClause(clauses: string[]): string {
  if (clauses.length === 0) return "";
  return clauses.join(" AND ");
}

/**
 * Returns a complete `WHERE …` pipe segment from an array of condition strings.
 *
 * Returns an empty string when the array is empty so callers can safely
 * include the result in a pipe chain without extra guards.
 */
export function buildWherePipe(clauses: string[]): string {
  const whereClause = buildWhereClause(clauses);
  if (!whereClause) return "";
  return `WHERE ${whereClause}`;
}

/**
 * Wraps string values for ES|QL `IN (...)` lists with proper escaping.
 */
export function buildValueList(values: string[]): string {
  return values.map((value) => `"${escapeEsqlString(value)}"`).join(", ");
}

/**
 * Builds a pipeline from query parts while skipping empty segments.
 */
export function buildPipeline(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join(" | ");
}

/**
 * Builds a reusable inclusive timestamp range clause.
 */
export function buildTimeRangeClause(field: string, fromExpr: string, toExpr: string): string {
  return `${field} >= ${fromExpr} AND ${field} <= ${toExpr}`;
}

/**
 * Normalizes common ES|QL time expressions.
 *
 * Supports:
 * - `NOW()`
 * - `NOW() +/- N <unit>`
 * - absolute timestamps parseable by `Date.parse` (returned as escaped quoted ISO)
 *
 * Returns `null` when the expression cannot be normalized safely.
 */
export function normalizeTimeExpression(expr: string): string | null {
  const trimmed = expr.trim();
  if (trimmed.toUpperCase() === "NOW()") return "NOW()";

  const relativeMatch = trimmed.match(
    /^NOW\(\)\s*([+-])\s*(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)$/i,
  );
  if (relativeMatch) {
    const [, operator, amount, rawUnit] = relativeMatch;
    return `NOW() ${operator} ${amount} ${rawUnit!.toLowerCase()}`;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return `"${escapeEsqlString(new Date(parsed).toISOString())}"`;
  }

  return null;
}
