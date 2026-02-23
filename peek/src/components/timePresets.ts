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
