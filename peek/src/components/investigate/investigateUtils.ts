export type InvestigateTab = "user" | "host" | "ip" | "domain" | "file";

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

/** System prompt instructing the LLM how to analyse the timeline. */
export const TIMELINE_SYSTEM_PROMPT =
  "You are a security analyst assistant. " +
  "Provide a concise security-focused summary of the activity timeline provided by the user. " +
  "Highlight any suspicious patterns, anomalies, or noteworthy sequences. " +
  "Group related events together and note the data sources involved.";

/** Serialize timeline events into context text for the LLM user message. */
export function buildTimelineContext(
  events: TimelineEvent[],
  tab: InvestigateTab,
  entity: string,
): string {
  const labelMap: Record<InvestigateTab, string> = {
    user: "user",
    host: "host",
    ip: "IP address",
    domain: "domain",
    file: "file",
  };
  const entityLabel = `${labelMap[tab]} "${entity}"`;
  const header = `Below is a chronological timeline of ${events.length} security-related events for ${entityLabel}. Each event includes its timestamp, data source, event category, action, outcome, and relevant context.\n\n`;
  const rows = events
    .slice(0, 100)
    .map(
      (e, i) =>
        `${i + 1}. [${e.timestamp}] source=${e.dataSource} category=${e.category} action=${e.action} outcome=${e.outcome} user=${e.userName} host=${e.hostName} ip=${e.sourceIp} message=${e.message}`,
    )
    .join("\n");
  return header + rows;
}
