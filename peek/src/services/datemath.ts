/**
 * Resolve Elasticsearch date-math expressions (e.g. "now", "now-1h") into
 * ISO-8601 timestamps.  Only the subset used by the dashboard time-range
 * presets is supported — full date-math is delegated to Elasticsearch where
 * possible.
 */

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

  const ms = Number(amount) * (UNIT_MS[unit!] ?? 0);
  return new Date(now.getTime() + (sign === "+" ? ms : -ms));
}
