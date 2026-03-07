/** Compact duration format for badges and pipeline steps: "142ms", "2.5s". */
export function formatDuration(durationMs: number): string {
  if (durationMs >= 1000) return `${(durationMs / 1000).toFixed(durationMs >= 10000 ? 0 : 1)}s`;
  return `${durationMs}ms`;
}

/** Verbose duration format for stats tables: "1,234 ms", "1.23 s", "n/a". */
export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return "n/a";
  if (ms < 1000) return `${ms.toLocaleString()} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Convert nanoseconds to a human-readable millisecond string. */
export function nanoToMs(nanos: number | undefined): string {
  if (nanos === undefined) return "\u2014";
  return `${(nanos / 1_000_000).toFixed(2)} ms`;
}
