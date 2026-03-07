import { formatDuration } from "../utils/formatDuration";

/** Format execution time for the panel health badge. */
export const formatMs: (ms: number) => string = formatDuration;

/** Format a row count with k/m/b suffix for the panel health badge. */
export function formatRowCount(count: number): string {
  if (count < 1_000) return String(count);
  if (count < 1_000_000) return `${(count / 1_000).toFixed(1)}k`;
  if (count < 1_000_000_000) return `${(count / 1_000_000).toFixed(1)}m`;
  return `${(count / 1_000_000_000).toFixed(1)}b`;
}

/** Format a Date as a human-readable "X ago" string for the panel health badge. */
export function formatTimeAgo(date: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
