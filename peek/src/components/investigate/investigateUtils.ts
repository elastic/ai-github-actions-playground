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
  const escaped = entity.replace(/'/g, "''");
  return [
    `FROM logs-*, .ds-logs-*, filebeat-*, auditbeat-*, winlogbeat-*`,
    `| WHERE ${field} == '${escaped}'`,
    `| SORT @timestamp DESC`,
    `| KEEP @timestamp, event.category, event.action, event.outcome, ${field}, host.name, user.name, source.ip, message, _index`,
    `| LIMIT 200`,
  ].join("\n");
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

/** Format an ISO timestamp to a compact locale string. */
export function formatTimestamp(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
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
