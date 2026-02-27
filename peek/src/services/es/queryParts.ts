/**
 * Shared ES|QL query-part helpers.
 *
 * Centralizes WHERE clause assembly so that all query modules use the same
 * formatting logic instead of duplicating `WHERE ${clauses.join(" AND ")}`.
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
 * Builds a reusable inclusive timestamp range clause.
 */
export function buildTimeRangeClause(field: string, fromExpr: string, toExpr: string): string {
  return `${field} >= ${fromExpr} AND ${field} <= ${toExpr}`;
}
