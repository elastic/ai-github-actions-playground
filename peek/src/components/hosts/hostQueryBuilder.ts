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
  'COALESCE(host.id, CONCAT(COALESCE(host.name, "unknown"), "::", COALESCE(host.os.type, "unknown")))';

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
| EVAL host_key = ${STABLE_HOST_ID_EXPRESSION}
| STATS
    host_id = MAX(host.id),
    host_name = MAX(host.name),
    os_type = MAX(host.os.type),
    os_name = MAX(host.os.name),
    os_version = MAX(host.os.version),
    last_seen = MAX(@timestamp),
    cpu_utilization = MAX(system.cpu.utilization),
    memory_utilization = MAX(system.memory.utilization),
    disk_utilization = MAX(system.filesystem.utilization),
    process_count = MAX(system.processes.count),
    agent_id = MAX(agent.id),
    cloud_instance_id = MAX(cloud.instance.id),
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
    host_id = host.id,
    host_name = host.name,
    os_type = host.os.type,
    os_name = host.os.name,
    os_version = host.os.version,
    last_seen = @timestamp,
    cpu_utilization = system.cpu.utilization,
    memory_utilization = system.memory.utilization,
    disk_utilization = system.filesystem.utilization,
    process_count = system.processes.count,
    agent_id = agent.id,
    cloud_instance_id = cloud.instance.id,
    host_ip = host.ip
| KEEP host_key, host_id, host_name, os_type, os_name, os_version, last_seen, cpu_utilization, memory_utilization, disk_utilization, process_count, agent_id, cloud_instance_id, host_ip`;
}
