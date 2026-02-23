import type { DashboardParameter } from "../types";

/**
 * Replace `{{name}}` tokens in a markdown template with matching dashboard
 * parameter values.  Unknown tokens (no matching parameter) are left as-is so
 * existing markdown panels are never broken.
 */
export function interpolateParameters(
  content: string,
  parameters: DashboardParameter[] | undefined,
): string {
  if (!parameters || parameters.length === 0) return content;

  return content.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const param = parameters.find((p) => p.name === name);
    return param !== undefined ? String(param.value) : match;
  });
}
