/**
 * Host identity and data model types.
 *
 * The identity contract uses `host.id` as the preferred key, falling back
 * to `host.name` (+ `host.os.type` disambiguation) when `host.id` is absent.
 */

/** OS types recognized by the host inventory. */
export type HostOsType = "linux" | "windows" | "macos" | "unknown";

/**
 * Lightweight reference for cross-surface navigation.
 * Consumed by `HostLink`, `openHost`, and any pivot that targets host detail.
 */
export interface HostRef {
  /** Primary identifier — `host.id` when available, else `host.name`. */
  hostId: string;
  /** Human-readable label shown in links/breadcrumbs. */
  displayName: string;
  osType: HostOsType;
}

/** A single host row as displayed in the inventory table. */
export interface HostRow {
  hostId: string;
  hostName: string;
  osType: HostOsType;
  osName: string;
  osVersion: string;
  lastSeen: string;
  cpuUtilization: number | null;
  memoryUtilization: number | null;
  diskUtilization: number | null;
  processCount: number | null;
}

/** Normalizes raw `host.os.type` string to a known `HostOsType`. */
export function normalizeOsType(raw: string | null | undefined): HostOsType {
  if (!raw) return "unknown";
  const lower = raw.toLowerCase().trim();
  if (lower === "linux") return "linux";
  if (lower === "windows") return "windows";
  if (lower === "darwin" || lower === "macos") return "macos";
  return "unknown";
}

/** Builds a deterministic `HostRef` from raw host fields. */
export function toHostRef(
  hostId: string | null | undefined,
  hostName: string | null | undefined,
  osType: string | null | undefined,
): HostRef {
  const id = hostId?.trim() || hostName?.trim() || "unknown";
  const display = hostName?.trim() || hostId?.trim() || "unknown";
  return { hostId: id, displayName: display, osType: normalizeOsType(osType) };
}

/** User-friendly OS label for display. */
export function osLabel(osType: HostOsType): string {
  switch (osType) {
    case "linux":
      return "Linux";
    case "windows":
      return "Windows";
    case "macos":
      return "macOS";
    case "unknown":
      return "Unknown";
  }
}
