/** Shared suffix for all page insight system prompts to prevent hallucination. */
export const INSIGHT_GUARDRAIL =
  " Base your response only on the data provided in the user message." +
  " If key data is unavailable, say so rather than guessing.";
