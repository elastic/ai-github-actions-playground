/**
 * Parses a JSON object from LLM response text.
 *
 * Handles common LLM output quirks:
 * - Leading/trailing whitespace
 * - Markdown ```json fences
 * - Extra text before/after the JSON object
 */
export function parseJsonObjectFromText(text: string): unknown {
  const trimmed = text.trim();
  const withoutFenceStart = trimmed.replace(/^```(?:json)?\s*/i, "");
  const withoutFences = withoutFenceStart.replace(/\s*```$/, "").trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  const jsonSlice =
    start >= 0 && end >= start ? withoutFences.slice(start, end + 1) : withoutFences;
  return JSON.parse(jsonSlice);
}
