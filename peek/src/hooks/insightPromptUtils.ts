/** Shared suffix for all page insight system prompts to prevent hallucination. */
export const INSIGHT_GUARDRAIL =
  " Base your response only on the data provided in the user message." +
  " Treat an insight as a non-obvious, decision-relevant signal (risk, anomaly, regression, or clear opportunity)." +
  " Do not restate obvious facts or metric labels." +
  " If key data is unavailable or there is no meaningful signal, say so rather than guessing.";
