/**
 * ES|QL query builders for host inventory and detail views.
 *
 * Targets `metrics-hostmetricsreceiver*` data streams using a short lookback
 * window (snapshot-based, no historical storage).
 */

import type { HostOsType } from "./hostTypes";

export interface HostQueryFilters {
  timeFrom: string;
  timeTo: string;
  osType?: HostOsType;
  search?: string;
}

/** Escapes a string for safe embedding in an ES|QL double-quoted literal. */
function escapeEsql(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Builds an ES|QL query that returns one row per host with the latest
 * snapshot metrics.
 */
export function buildHostInventoryQuery(filters: HostQueryFilters): string {
  const whereConditions: string[] = [
    `@timestamp >= ${filters.timeFrom}`,
    `@timestamp <= ${filters.timeTo}`,
  ];

  if (filters.osType && filters.osType !== "unknown") {
    const osValue = filters.osType === "macos" ? "darwin" : filters.osType;
    whereConditions.push(`host.os.type == "${osValue}"`);
  }

  if (filters.search) {
    const escaped = escapeEsql(filters.search);
    whereConditions.push(`host.name LIKE "*${escaped}*"`);
  }

  return `FROM metrics-hostmetricsreceiver*
| WHERE ${whereConditions.join(" AND ")}
| STATS
    host_name = MAX(host.name),
    os_type = MAX(host.os.type),
    os_name = MAX(host.os.name),
    os_version = MAX(host.os.version),
    last_seen = MAX(@timestamp),
    cpu_utilization = AVG(system.cpu.utilization),
    memory_utilization = AVG(system.memory.utilization),
    disk_utilization = MAX(system.filesystem.utilization),
    process_count = MAX(system.processes.count)
  BY host.id
| SORT last_seen DESC`;
}

/**
 * Builds an ES|QL query for a single host detail view, returning the
 * latest snapshot of all available metrics.
 */
export function buildHostDetailQuery(hostId: string, filters: HostQueryFilters): string {
  const escaped = escapeEsql(hostId);
  return `FROM metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${filters.timeFrom}
  AND @timestamp <= ${filters.timeTo}
  AND host.id == "${escaped}"
| STATS
    host_name = MAX(host.name),
    os_type = MAX(host.os.type),
    os_name = MAX(host.os.name),
    os_version = MAX(host.os.version),
    last_seen = MAX(@timestamp),
    cpu_utilization = AVG(system.cpu.utilization),
    memory_utilization = AVG(system.memory.utilization),
    disk_utilization = MAX(system.filesystem.utilization),
    process_count = MAX(system.processes.count)
  BY host.id`;
}
