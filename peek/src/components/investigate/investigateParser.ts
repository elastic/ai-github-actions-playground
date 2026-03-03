import type { EsqlResponse } from "../../types";

import type { InvestigateTab, TimelineEvent } from "./investigateUtils";
import { investigateField } from "./investigateQueryBuilder";
import { INVESTIGATE_TIMELINE_FIELDS } from "./investigateSchema";

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
  const [
    timestampField,
    categoryField,
    actionField,
    outcomeField,
    userNameField,
    hostNameField,
    sourceIpField,
    messageField,
    dataSourceField,
  ] = INVESTIGATE_TIMELINE_FIELDS;
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
    timestamp: get(row, timestampField),
    category: get(row, categoryField),
    action: get(row, actionField),
    outcome: get(row, outcomeField),
    userName: get(row, userNameField),
    hostName: get(row, hostNameField),
    sourceIp: get(row, sourceIpField),
    message: get(row, messageField),
    dataSource: get(row, dataSourceField),
  }));
}
