/**
 * Parsing utilities that transform raw ES|QL responses into typed host rows.
 */

import type { EsqlResponse } from "../../types";
import { normalizeOsType, type HostRow } from "./hostTypes";

function col(columns: Array<{ name: string }>, name: string): number {
  return columns.findIndex((c) => c.name === name);
}

function str(row: unknown[], index: number): string {
  if (index < 0 || index >= row.length) return "";
  const v = row[index];
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

function num(row: unknown[], index: number): number | null {
  if (index < 0 || index >= row.length) return null;
  const v = row[index];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Parses a host inventory ES|QL response into an array of `HostRow` objects.
 */
export function parseHostInventory(data: EsqlResponse): HostRow[] {
  const columns = data.columns ?? [];
  const values = data.values ?? [];
  if (columns.length === 0 || values.length === 0) return [];

  const iHostId = col(columns, "host.id");
  const iHostName = col(columns, "host_name");
  const iOsType = col(columns, "os_type");
  const iOsName = col(columns, "os_name");
  const iOsVersion = col(columns, "os_version");
  const iLastSeen = col(columns, "last_seen");
  const iCpu = col(columns, "cpu_utilization");
  const iMem = col(columns, "memory_utilization");
  const iDisk = col(columns, "disk_utilization");
  const iProc = col(columns, "process_count");

  return values.map((row) => ({
    hostId: str(row, iHostId) || str(row, iHostName) || "unknown",
    hostName: str(row, iHostName),
    osType: normalizeOsType(str(row, iOsType)),
    osName: str(row, iOsName),
    osVersion: str(row, iOsVersion),
    lastSeen: str(row, iLastSeen),
    cpuUtilization: num(row, iCpu),
    memoryUtilization: num(row, iMem),
    diskUtilization: num(row, iDisk),
    processCount: num(row, iProc),
  }));
}
