import { escapeEsqlString } from "../../services/es/esqlUtils";
import type { EsqlResponse } from "../../types";

export type InvestigateTab = "user" | "host";

export interface TimelineEvent {
  timestamp: string;
  category: string;
  action: string;
  outcome: string;
  userName: string;
  hostName: string;
  sourceIp: string;
  message: string;
  dataSource: string;
}

/** Build an ES|QL query to fetch recent events for a given user or host. */
export function buildInvestigateQuery(tab: InvestigateTab, entity: string): string {
  const field = tab === "user" ? "user.name" : "host.name";
  const escaped = escapeEsqlString(entity);
  return [
    `FROM logs-*, .ds-logs-*, filebeat-*, auditbeat-*, winlogbeat-*`,
    `| WHERE ${field} == "${escaped}"`,
    `| SORT @timestamp DESC`,
    `| LIMIT 200`,
  ].join("\n");
}

/** Build an ES|QL query to discover recent distinct users or hosts. */
export function buildRecentEntitiesQuery(tab: InvestigateTab): string {
  const field = tab === "user" ? "user.name" : "host.name";
  return [
    `FROM logs-*, .ds-logs-*, filebeat-*, auditbeat-*, winlogbeat-*`,
    `| WHERE ${field} IS NOT NULL`,
    `| STATS event_count = COUNT(*), last_seen = MAX(@timestamp) BY ${field}`,
    `| SORT last_seen DESC`,
    `| LIMIT 10`,
  ].join("\n");
}

/** Parse ES|QL response into a list of recent entity suggestions. */
export function parseRecentEntities(
  data: EsqlResponse,
  tab: InvestigateTab,
): Array<{ name: string; eventCount: number; lastSeen: string }> {
  const fieldName = tab === "user" ? "user.name" : "host.name";
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

/** Build an LLM-ready text prompt summarising the timeline events. */
export function buildSummaryPrompt(
  events: TimelineEvent[],
  tab: InvestigateTab,
  entity: string,
): string {
  const entityLabel = tab === "user" ? `user "${entity}"` : `host "${entity}"`;
  const header = `Below is a chronological timeline of ${events.length} security-related events for ${entityLabel}. Each event includes its timestamp, data source, event category, action, outcome, and relevant context.\n\n`;
  const rows = events
    .slice(0, 100)
    .map(
      (e, i) =>
        `${i + 1}. [${e.timestamp}] source=${e.dataSource} category=${e.category} action=${e.action} outcome=${e.outcome} user=${e.userName} host=${e.hostName} ip=${e.sourceIp} message=${e.message}`,
    )
    .join("\n");
  return (
    header +
    rows +
    "\n\nProvide a concise security-focused summary of this activity timeline. " +
    "Highlight any suspicious patterns, anomalies, or noteworthy sequences. " +
    "Group related events together and note the data sources involved."
  );
}
