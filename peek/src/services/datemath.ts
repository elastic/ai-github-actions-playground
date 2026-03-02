/**
 * Resolve Elasticsearch date-math expressions (e.g. "now", "now-1h") into
 * ISO-8601 timestamps.  Only the subset used by the dashboard time-range
 * presets is supported — full date-math is delegated to Elasticsearch where
 * possible.
 */

import type { DashboardParameter, TimeRange } from "../types";

const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

const DATE_MATH_RE = /^now(?:([+-])(\d+)([smhdw]))?$/;
function hasNamedPlaceholder(query: string, name: string): boolean {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\?${escapedName}(?![A-Za-z0-9_])`);
  return pattern.test(query);
}

/**
 * Resolve a single date-math expression to a `Date`.
 * Returns `undefined` when the expression is not recognised.
 */
export function resolveDateTime(expr: string, now: Date = new Date()): Date | undefined {
  const match = DATE_MATH_RE.exec(expr.trim());
  if (!match) return undefined;

  const [, sign, amount, unit] = match;
  if (!sign) return new Date(now.getTime()); // plain "now"

  const ms = Number(amount) * UNIT_MS[unit!]!;
  return new Date(now.getTime() + (sign === "+" ? ms : -ms));
}

/**
 * Build ES|QL named-parameter entries for `_tstart` / `_tend` when the
 * query references them.  Returns an empty object when neither placeholder
 * is present.
 */
export function buildTimeParams(query: string, timeRange: TimeRange): Record<string, string> {
  const needs_tstart = hasNamedPlaceholder(query, "_tstart");
  const needs_tend = hasNamedPlaceholder(query, "_tend");
  if (!needs_tstart && !needs_tend) return {};

  const now = new Date();
  const params: Record<string, string> = {};

  if (needs_tstart) {
    const resolved = resolveDateTime(timeRange.from, now);
    params._tstart = resolved ? resolved.toISOString() : timeRange.from;
  }
  if (needs_tend) {
    const resolved = resolveDateTime(timeRange.to, now);
    params._tend = resolved ? resolved.toISOString() : timeRange.to;
  }

  return params;
}

/**
 * Build the full ES|QL `params` object by merging time-range parameters with
 * user-defined dashboard parameters.  Only parameters actually referenced in
 * the query (via `?name`) are included.
 */
export function buildQueryParams(
  query: string,
  timeRange: TimeRange,
  userParams?: DashboardParameter[],
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {
    ...buildTimeParams(query, timeRange),
  };

  if (userParams) {
    for (const { name, value, type } of userParams) {
      if (name && hasNamedPlaceholder(query, name)) {
        params[name] = serializeDashboardParam(type, value);
      }
    }
  }

  return params;
}

function serializeDashboardParam(
  type: DashboardParameter["type"],
  value: DashboardParameter["value"],
): string | number | boolean {
  switch (type) {
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) {
        throw new TypeError(`Invalid numeric value: ${String(value)}`);
      }
      return n;
    }
    case "boolean":
      if (typeof value === "boolean") return value;
      return String(value).toLowerCase() === "true";
    case "date": {
      const parsed = Date.parse(String(value));
      return Number.isNaN(parsed) ? String(value) : new Date(parsed).toISOString();
    }
    case "keyword":
    default:
      return String(value);
  }
}
