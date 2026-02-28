/** Semantic threshold color values used in visualization schemas and types. */
export const THRESHOLD_COLORS = ["success", "warning", "error"] as const;
export type ThresholdColor = (typeof THRESHOLD_COLORS)[number];

/** ES|QL parameter type values used in dashboard parameter schemas and types. */
export const PARAMETER_TYPES = ["keyword", "number", "boolean", "date"] as const;
export type ParameterType = (typeof PARAMETER_TYPES)[number];

/** Parameter source mode literals used in discriminated union schemas and types. */
export const PARAMETER_SOURCE_MODES = {
  text: "text",
  options: "options",
  esql: "esql",
} as const;
