import { resolveDateTime } from "../services/datemath";
import { escapeEsqlString } from "../services/es/esqlUtils";
import type { TimeRange } from "../types";

const RELATIVE_TIME_PRESETS: Array<{
  label: string;
  dashboardRange: TimeRange;
  tracesRange: { from: string; to: string };
}> = [
  {
    label: "Last 15m",
    dashboardRange: { from: "now-15m", to: "now" },
    tracesRange: { from: "NOW() - 15 minutes", to: "NOW()" },
  },
  {
    label: "Last 1h",
    dashboardRange: { from: "now-1h", to: "now" },
    tracesRange: { from: "NOW() - 1 hour", to: "NOW()" },
  },
  {
    label: "Last 4h",
    dashboardRange: { from: "now-4h", to: "now" },
    tracesRange: { from: "NOW() - 4 hours", to: "NOW()" },
  },
  {
    label: "Last 24h",
    dashboardRange: { from: "now-24h", to: "now" },
    tracesRange: { from: "NOW() - 24 hours", to: "NOW()" },
  },
  {
    label: "Last 7d",
    dashboardRange: { from: "now-7d", to: "now" },
    tracesRange: { from: "NOW() - 7 days", to: "NOW()" },
  },
  {
    label: "Last 30d",
    dashboardRange: { from: "now-30d", to: "now" },
    tracesRange: { from: "NOW() - 30 days", to: "NOW()" },
  },
];

export const DASHBOARD_TIME_PRESETS: Array<{ label: string; range: TimeRange }> =
  RELATIVE_TIME_PRESETS.map((preset) => ({ label: preset.label, range: preset.dashboardRange }));

export const TRACE_TIME_RANGE_OPTIONS: Array<{
  label: string;
  from: string | null;
  to: string | null;
}> = [
  { label: "Any time", from: null, to: null },
  ...RELATIVE_TIME_PRESETS.map((preset) => ({
    label: preset.label,
    from: preset.tracesRange.from,
    to: preset.tracesRange.to,
  })),
];

export function toDashboardTimeRange(traceRange: { from: string; to: string }): TimeRange {
  const tracePreset = TRACE_TIME_RANGE_OPTIONS.find(
    (option) => option.from === traceRange.from && option.to === traceRange.to,
  );
  if (!tracePreset) return traceRange;
  const dashboardPreset = DASHBOARD_TIME_PRESETS.find(
    (preset) => preset.label === tracePreset.label,
  );
  return dashboardPreset?.range ?? traceRange;
}

/**
 * Resolve trace time range (ES|QL expressions) to milliseconds for chart axes.
 * Returns null when the range cannot be resolved (e.g. "Any time" or custom).
 */
export function resolveTraceTimeRangeToMs(
  timeFrom: string | null,
  timeTo: string | null,
  now: Date = new Date(),
): { min: number; max: number } | null {
  if (!timeFrom || !timeTo) return null;
  const preset = TRACE_TIME_RANGE_OPTIONS.find((opt) => opt.from === timeFrom && opt.to === timeTo);
  if (!preset || preset.from === null || preset.to === null) return null;
  const dashboardPreset = DASHBOARD_TIME_PRESETS.find((p) => p.label === preset.label);
  if (!dashboardPreset) return null;
  const fromDate = resolveDateTime(dashboardPreset.range.from, now);
  const toDate = resolveDateTime(dashboardPreset.range.to, now);
  if (!fromDate || !toDate) return null;
  return { min: fromDate.getTime(), max: toDate.getTime() };
}

export function toTraceTimeRange(range: TimeRange): { from: string; to: string } {
  // Try known preset match first (relative presets get clean ES|QL syntax)
  const dashboardPreset = DASHBOARD_TIME_PRESETS.find(
    (preset) => preset.range.from === range.from && preset.range.to === range.to,
  );
  if (dashboardPreset) {
    const tracePreset = TRACE_TIME_RANGE_OPTIONS.find(
      (option) =>
        option.label === dashboardPreset.label && option.from !== null && option.to !== null,
    );
    if (tracePreset?.from && tracePreset.to) {
      return { from: tracePreset.from, to: tracePreset.to };
    }
  }

  // Custom / absolute range: resolve date-math and wrap in TO_DATETIME() for ES|QL
  const now = new Date();
  const fromResolved = resolveDateTime(range.from, now);
  const toResolved = resolveDateTime(range.to, now);
  const fromIso = fromResolved ? fromResolved.toISOString() : range.from;
  const toIso = toResolved ? toResolved.toISOString() : range.to;
  return {
    from: `TO_DATETIME("${escapeEsqlString(fromIso)}")`,
    to: `TO_DATETIME("${escapeEsqlString(toIso)}")`,
  };
}
