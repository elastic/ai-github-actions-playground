import type { EsqlResponse } from "../../types";

import type { InvestigateTab, TimelineEvent } from "./investigateUtils";
import { investigateField } from "./investigateQueryBuilder";

/** Parse ES|QL response into a list of recent entity suggestions. */
export function parseRecentEntities(
  data: EsqlResponse,
  tab: InvestigateTab,
): Array<{ name: string; eventCount: number; lastSeen: string }> {
  const fieldName = investigateField(tab);
  const colIndex = new Map<string, number>();
  for (let i = 0; i < data.columns.length; i++) {
    colIndex.set(data.columns[i]!.name, i);
  }
  const nameIdx = colIndex.get(fieldName);
  const countIdx = colIndex.get("event_count");
  const lastSeenIdx = colIndex.get("last_seen");
  if (nameIdx === undefined) return [];

  return data.values
    .map((row) => {
      const raw = row[nameIdx];
      const name = Array.isArray(raw) ? raw[0] : raw;
      return {
        name: name != null ? String(name) : "",
        eventCount: countIdx !== undefined ? Number(row[countIdx]) || 0 : 0,
        lastSeen: lastSeenIdx !== undefined ? String(row[lastSeenIdx] ?? "") : "",
      };
    })
    .filter((e) => e.name !== "");
}

/** Parse ES|QL response columns/values into structured timeline events. */
export function parseTimelineEvents(data: EsqlResponse): TimelineEvent[] {
  const colIndex = new Map<string, number>();
  for (let i = 0; i < data.columns.length; i++) {
    colIndex.set(data.columns[i]!.name, i);
  }
  const get = (row: unknown[], field: string): string => {
    const idx = colIndex.get(field);
    if (idx === undefined) return "";
    const val = row[idx];
    if (val == null) return "";
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  };

  return data.values.map((row) => ({
    timestamp: get(row, "@timestamp"),
    category: get(row, "event.category"),
    action: get(row, "event.action"),
    outcome: get(row, "event.outcome"),
    userName: get(row, "user.name"),
    hostName: get(row, "host.name"),
    sourceIp: get(row, "source.ip"),
    message: get(row, "message"),
    dataSource: get(row, "_index"),
  }));
}
