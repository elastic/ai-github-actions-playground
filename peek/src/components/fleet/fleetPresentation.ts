// ---------------------------------------------------------------------------
// Fleet presentation helpers – single source of truth for Fleet UI formatting
// ---------------------------------------------------------------------------

/**
 * Maps a checkin staleness severity value to an MUI color name.
 * Use the returned value directly as a Chip/Badge `color` prop, or append
 * `.main` when targeting the MUI theme palette via an `sx` color property.
 */
export function stalenessSeverityToColor(
  severity: "fresh" | "stale" | "critical",
): "success" | "warning" | "error" {
  if (severity === "fresh") return "success";
  if (severity === "stale") return "warning";
  return "error";
}

/** Format a timestamp as locale time only (e.g. "2:30:15 PM"). */
export function formatFleetTime(ts: string): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return ts;
  }
}

/** Format a timestamp as full locale date+time (e.g. "2/23/2026, 2:30:15 PM"). */
export function formatFleetTimestamp(ts: string): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}
