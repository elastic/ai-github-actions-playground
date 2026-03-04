/** Shared suffix for all page insight system prompts to prevent hallucination. */
export const INSIGHT_GUARDRAIL =
  " Base your response only on the data provided in the user message." +
  " Treat an insight as a non-obvious, decision-relevant signal (risk, anomaly, regression, or clear opportunity)." +
  " Do not restate obvious facts or metric labels." +
  " Avoid generic praise or KPI restatements (for example: 'high reliability because errors are zero')." +
  " Prefer comparative framing (change, concentration, ranking, imbalance, or outlier) and include concrete values only when they add decision value." +
  " If key data is unavailable or there is no meaningful signal, say so rather than guessing.";

/** Shared instruction to force slot-local, most-specific insight targeting. */
export const INSIGHT_SPECIFICITY_POLICY =
  " Target the most specific active scope first (selected span/row/trace/group, then panel aggregate, then page summary)." +
  " Keep each slot insight scoped to that slot; do not summarize unrelated sections." +
  " If a specific selection exists, anchor to it unless required fields are missing.";
