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
