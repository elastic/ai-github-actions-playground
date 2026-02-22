/**
 * Resolve Elasticsearch date-math expressions (e.g. "now", "now-1h") into
 * ISO-8601 timestamps.  Only the subset used by the dashboard time-range
 * presets is supported — full date-math is delegated to Elasticsearch where
 * possible.
 */

import type { TimeRange } from "../types";

const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

const DATE_MATH_RE = /^now(?:([+-])(\d+)([smhdw]))?$/;

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
 * query references them.  Returns an empty array when neither placeholder
 * is present.
 */
export function buildTimeParams(
  query: string,
  timeRange: TimeRange,
): Array<Record<string, string>> {
  const needs_tstart = query.includes("?_tstart");
  const needs_tend = query.includes("?_tend");
  if (!needs_tstart && !needs_tend) return [];

  const now = new Date();
  const params: Array<Record<string, string>> = [];

  if (needs_tstart) {
    const resolved = resolveDateTime(timeRange.from, now);
    if (resolved) params.push({ _tstart: resolved.toISOString() });
  }
  if (needs_tend) {
    const resolved = resolveDateTime(timeRange.to, now);
    if (resolved) params.push({ _tend: resolved.toISOString() });
  }

  return params;
}
