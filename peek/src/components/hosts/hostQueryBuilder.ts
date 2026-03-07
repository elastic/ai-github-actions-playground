/**
 * ES|QL query builders for host inventory and detail views.
 *
 * Targets `metrics-hostmetricsreceiver*` data streams.
 *
 * - Inventory / detail snapshot queries use `FROM` (arbitrary EVAL grouping).
 * - Time-series chart queries use the `TS` source command (ES 9.2+), which
 *   unlocks RATE() for counter metrics and *_OVER_TIME() for gauges, and
 *   pairs with 4-parameter BUCKET() for adaptive time bucketing.
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
  'CONCAT(COALESCE(host.name, TO_STRING(host.ip), "unknown"), "::", COALESCE(os.type, "unknown"))';

/**
 * Supported metric fields for time-series queries.
 * Load-average fields are handled separately via `buildHost*LoadAverageQuery`.
 */
export type HostTimeSeriesMetric =
  | "system.cpu.utilization"
  | "system.memory.utilization"
  | "system.disk.io"
  | "system.network.io"
  | "system.cpu.load_average.1m"
  | "system.cpu.load_average.5m"
  | "system.cpu.load_average.15m";

/**
 * Counter metrics (counter_long / monotonically increasing) that must use
 * RATE() in TS queries to produce a meaningful per-second rate.
 */
const COUNTER_METRICS: ReadonlySet<HostTimeSeriesMetric> = new Set([
  "system.disk.io",
  "system.network.io",
]);

/**
 * Fields whose names contain a numeric segment and must be backtick-quoted
 * in ES|QL (e.g. `system.cpu.load_average.1m`).
 */
function esqlField(field: HostTimeSeriesMetric): string {
  return /\.\d/.test(field) ? `\`${field}\`` : field;
}

/**
 * Returns the correct STATS aggregation expression for a metric field:
 * - Counter metrics → `SUM(RATE(field))` (per-second rate of increase)
 * - Gauge metrics   → `MAX(AVG_OVER_TIME(field))` (average within each bucket)
 */
function metricAgg(field: HostTimeSeriesMetric): string {
  const f = esqlField(field);
  return COUNTER_METRICS.has(field) ? `SUM(RATE(${f}))` : `MAX(AVG_OVER_TIME(${f}))`;
}

/**
 * Builds the shared WHERE conditions for time-range, OS, and search filters.
 */
function buildWhereConditions(filters: HostQueryFilters): string[] {
  const conditions: string[] = [
    `@timestamp >= ${filters.timeFrom}`,
    `@timestamp <= ${filters.timeTo}`,
  ];
  if (filters.osType && filters.osType !== "unknown") {
    const osValue = filters.osType === "macos" ? "darwin" : filters.osType;
    conditions.push(`os.type == "${osValue}"`);
  }
  if (filters.search) {
    const escaped = escapeEsql(filters.search);
    conditions.push(`host.name LIKE "*${escaped}*"`);
  }
  return conditions;
}

/**
 * Builds an ES|QL query that returns one row per host with the latest
 * snapshot metrics.
 */
export function buildHostInventoryQuery(filters: HostQueryFilters): string {
  const whereConditions = buildWhereConditions(filters);

  return `FROM metrics-hostmetricsreceiver*
| WHERE ${whereConditions.join(" AND ")}
| EVAL host_key = ${STABLE_HOST_ID_EXPRESSION}
| STATS
    host_name = MAX(host.name),
    os_type = MAX(os.type),
    os_name = MAX(host.os.name),
    os_version = MAX(host.os.version),
    os_full = MAX(host.os.full),
    last_seen = MAX(@timestamp),
    cpu_utilization = MAX(system.cpu.utilization),
    memory_utilization = MAX(system.memory.utilization),
    process_count = MAX(system.processes.count),
    load_avg_1m = MAX(\`system.cpu.load_average.1m\`),
    host_arch = MAX(host.arch),
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
    os_full = host.os.full,
    last_seen = @timestamp,
    cpu_utilization = system.cpu.utilization,
    memory_utilization = system.memory.utilization,
    process_count = system.processes.count,
    load_avg_1m = \`system.cpu.load_average.1m\`,
    host_arch = host.arch,
    host_ip = host.ip
| KEEP host_key, host_name, os_type, os_name, os_version, os_full, last_seen, cpu_utilization, memory_utilization, process_count, load_avg_1m, host_arch, host_ip`;
}

/**
 * Builds a TS-backed time-series query returning adaptive time buckets for a
 * single metric across all hosts matching the filters.
 *
 * Uses the TS source command (ES 9.2+) for:
 * - RATE() on counter metrics (disk/network I/O)
 * - AVG_OVER_TIME() on gauge metrics (cpu, memory, load average)
 * - 4-parameter BUCKET() for adaptive bucket sizing
 */
export function buildHostTimeSeriesQuery(
  metricField: HostTimeSeriesMetric,
  filters: HostQueryFilters,
): string {
  const whereConditions = buildWhereConditions(filters);
  return `TS metrics-hostmetricsreceiver*
| WHERE ${whereConditions.join(" AND ")}
| STATS metric_value = ${metricAgg(metricField)}
    BY bucket = BUCKET(@timestamp, 20, ${filters.timeFrom}, ${filters.timeTo})
| SORT bucket ASC`;
}

/**
 * Builds a TS-backed multi-metric time-series query for load averages
 * (1m, 5m, 15m) returned as separate columns.
 */
export function buildHostLoadAverageTimeSeriesQuery(filters: HostQueryFilters): string {
  const whereConditions = buildWhereConditions(filters);
  return `TS metrics-hostmetricsreceiver*
| WHERE ${whereConditions.join(" AND ")}
| STATS
    load_1m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.1m\`)),
    load_5m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.5m\`)),
    load_15m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.15m\`))
  BY bucket = BUCKET(@timestamp, 20, ${filters.timeFrom}, ${filters.timeTo})
| SORT bucket ASC`;
}

/**
 * Builds a TS-backed time-series query for a single host and metric.
 */
export function buildHostDetailTimeSeriesQuery(
  hostId: string,
  metricField: HostTimeSeriesMetric,
  filters: HostQueryFilters,
): string {
  const escaped = escapeEsql(hostId);
  return `TS metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${filters.timeFrom}
  AND @timestamp <= ${filters.timeTo}
  AND ${STABLE_HOST_ID_EXPRESSION} == "${escaped}"
| STATS metric_value = ${metricAgg(metricField)}
    BY bucket = BUCKET(@timestamp, 20, ${filters.timeFrom}, ${filters.timeTo})
| SORT bucket ASC`;
}

/**
 * Builds a TS-backed load-average time-series query for a single host.
 */
export function buildHostDetailLoadAverageQuery(
  hostId: string,
  filters: HostQueryFilters,
): string {
  const escaped = escapeEsql(hostId);
  return `TS metrics-hostmetricsreceiver*
| WHERE @timestamp >= ${filters.timeFrom}
  AND @timestamp <= ${filters.timeTo}
  AND ${STABLE_HOST_ID_EXPRESSION} == "${escaped}"
| STATS
    load_1m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.1m\`)),
    load_5m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.5m\`)),
    load_15m = MAX(AVG_OVER_TIME(\`system.cpu.load_average.15m\`))
  BY bucket = BUCKET(@timestamp, 20, ${filters.timeFrom}, ${filters.timeTo})
| SORT bucket ASC`;
}
