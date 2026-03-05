// ---------------------------------------------------------------------------
// Shared date/time formatting helpers
// ---------------------------------------------------------------------------
// Centralises locale-aware date formatting so that every page uses consistent
// options.  All helpers accept the same flexible input type so callers don't
// need to pre-convert values.

type DateInput = string | number | Date;

/**
 * Format a value as a full locale date+time string.
 *
 * Example output: "2/23/2026, 2:30:15 PM"
 */
export function formatTimestamp(value: DateInput): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

/**
 * Format a value as a locale date string (no time component).
 *
 * Example output: "2/23/2026"
 */
export function formatDate(value: DateInput): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

/** Intl options for compact chart x-axis labels (e.g. trace metrics). */
export const CHART_AXIS_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

/**
 * Format a value for chart x-axis labels. Uses consistent format across
 * trace metrics (Requests, Errors, Latency).
 */
export function formatChartAxisDate(value: DateInput): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(undefined, CHART_AXIS_DATE_OPTIONS);
}

/**
 * Format a value as a locale time string.
 *
 * When called without options it returns the full time (e.g. "2:30:15 PM").
 * Pass `short: true` for hours, minutes, and seconds with 2-digit formatting.
 */
export function formatTime(value: DateInput, options?: { short?: boolean }): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  if (options?.short) {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  return d.toLocaleTimeString();
}
