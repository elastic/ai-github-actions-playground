export function formatDuration(durationMs: number): string {
  if (durationMs >= 1000) return `${(durationMs / 1000).toFixed(durationMs >= 10000 ? 0 : 1)}s`;
  return `${durationMs}ms`;
}
