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
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\*/g, "\\*")
    .replace(/\?/g, "\\?");
}

const STABLE_HOST_ID_EXPRESSION =
  'CONCAT(COALESCE(host.name, "unknown"), "::", COALESCE(os.type, "unknown"))';

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
    whereConditions.push(`os.type == "${osValue}"`);
  }

  if (filters.search) {
    const escaped = escapeEsql(filters.search);
    whereConditions.push(`host.name LIKE "*${escaped}*"`);
  }

  return `FROM metrics-hostmetricsreceiver*
| WHERE ${whereConditions.join(" AND ")}
| EVAL host_key = ${STABLE_HOST_ID_EXPRESSION}
| STATS
    host_name = MAX(host.name),
    os_type = MAX(os.type),
    os_name = MAX(host.os.name),
    os_version = MAX(host.os.version),
    last_seen = MAX(@timestamp),
    cpu_utilization = MAX(system.cpu.utilization),
    memory_utilization = MAX(system.memory.utilization),
    process_count = MAX(system.processes.count),
    host_ip = MAX(host.ip)
  BY host_key
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
  AND ${STABLE_HOST_ID_EXPRESSION} == "${escaped}"
| SORT @timestamp DESC
| LIMIT 1
| EVAL
    host_key = ${STABLE_HOST_ID_EXPRESSION},
    host_name = host.name,
    os_type = os.type,
    os_name = host.os.name,
    os_version = host.os.version,
    last_seen = @timestamp,
    cpu_utilization = system.cpu.utilization,
    memory_utilization = system.memory.utilization,
    process_count = system.processes.count,
    host_ip = host.ip
| KEEP host_key, host_name, os_type, os_name, os_version, last_seen, cpu_utilization, memory_utilization, process_count, host_ip`;
}
