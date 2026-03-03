export type InvestigateTab = "user" | "host" | "ip" | "domain" | "file";

export const INVESTIGATE_TAB_LABEL: Record<InvestigateTab, string> = {
  user: "user",
  host: "host",
  ip: "IP address",
  domain: "domain",
  file: "file",
};

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

/** A notable event identified by the LLM for display on the visual timeline. */
export interface TimelineMarker {
  /** ISO 8601 timestamp of the event. */
  timestamp: string;
  /** Short label for the timeline marker (2–5 words). */
  label: string;
  /** Brief description of why this event is notable. */
  description: string;
  /** Severity level for color coding. */
  severity: "info" | "warning" | "critical";
}

/** System prompt instructing the LLM how to analyse the timeline. */
export const TIMELINE_SYSTEM_PROMPT =
  "You are a security analyst assistant. " +
  "Analyze the security event timeline and provide a concise summary. " +
  "Structure: 1) Overview of activity window and volume, " +
  "2) Suspicious patterns or anomalies (with timestamps), " +
  "3) Data sources involved. " +
  "Use short paragraphs, not bullet lists. Base analysis only on the events provided.";

/** System prompt for the structured timeline-markers response. */
export const TIMELINE_MARKERS_SYSTEM_PROMPT =
  "You are a security analyst. Analyze the security event timeline and identify the most notable events to highlight on a visual timeline. " +
  "Return up to 8 markers, and never more markers than available events. " +
  "Choose timestamps that exist in the provided events. " +
  'For severity use "info" for normal activity, "warning" for suspicious patterns, and "critical" for security incidents or failures.';

/** Serialize timeline events into context text for the LLM user message. */
export function buildTimelineContext(
  events: TimelineEvent[],
  tab: InvestigateTab,
  entity: string,
): string {
  const entityLabel = `${INVESTIGATE_TAB_LABEL[tab]} "${entity}"`;
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
