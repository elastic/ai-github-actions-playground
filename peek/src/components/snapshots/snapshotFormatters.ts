export function stateColor(state: string): "success" | "error" | "warning" | "info" | "default" {
  switch (state) {
    case "SUCCESS":
      return "success";
    case "FAILED":
      return "error";
    case "PARTIAL":
      return "warning";
    case "IN_PROGRESS":
      return "info";
    default:
      return "default";
  }
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(1)}m`;
  const h = m / 60;
  return `${h.toFixed(1)}h`;
}

export function formatRelativeTime(ms: number): string {
  if (!ms) return "—";
  const now = Date.now();
  const diff = now - ms;
  if (diff < 0) {
    const absDiff = Math.abs(diff);
    if (absDiff < 60_000) return "in <1m";
    if (absDiff < 3_600_000) return `in ${Math.round(absDiff / 60_000)}m`;
    if (absDiff < 86_400_000) return `in ${Math.round(absDiff / 3_600_000)}h`;
    return `in ${Math.round(absDiff / 86_400_000)}d`;
  }
  if (diff < 60_000) return "<1m ago";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

export function summarizeSettings(settings: Record<string, string>): string {
  const preferredKeys = ["bucket", "base_path", "location", "container", "path"];
  const preferred = preferredKeys.filter((k) => settings[k]).map((k) => `${k}: ${settings[k]}`);
  if (preferred.length > 0) return preferred.join(", ");
  const fallback = Object.entries(settings)
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${v}`);
  return fallback.length > 0 ? fallback.join(", ") : "—";
}
