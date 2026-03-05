/** Defines a named slot where a component can display an AI insight. */
export interface InsightSlotDefinition {
  /** Unique identifier for the slot (e.g. "cluster-health-card", "index-count"). */
  slotId: string;
  /** Short human-readable label describing what this slot shows. */
  label: string;
}

/** A single insight targeted at a specific slot. */
export interface SlotInsight {
  /** Matches `InsightSlotDefinition.slotId`. */
  slotId: string;
  /** Concise insight text for display in the component. */
  text: string;
  /** Optional severity hint. */
  severity?: "info" | "warning" | "critical";
  /** For metrics: suggested dimension field to group by (e.g. host.name). */
  suggestedDimension?: string;
}

/** Top-level response shape returned by the LLM for one page of slot insights. */
export interface PageInsightsResponse {
  /** High-level page summary (may be shown in a banner). */
  summary: string;
  /** Per-slot insights keyed by their slotId. */
  insights: SlotInsight[];
}
