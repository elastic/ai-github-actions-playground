import type { DashboardParameter } from "../../types";

export const EMPTY_PARAM: DashboardParameter = {
  name: "",
  label: "",
  type: "keyword",
  source: { mode: "text" },
  value: "",
};

export const EMPTY_PARAMETERS: DashboardParameter[] = [];

export type ParameterValue = DashboardParameter["value"];

export function parseParameterValue(
  type: DashboardParameter["type"],
  rawValue: string,
): { value?: ParameterValue; error?: string } {
  if (type === "keyword") {
    return { value: rawValue };
  }
  if (type === "number") {
    const parsed = Number(rawValue);
    if (rawValue.trim() === "" || Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      return { error: "Enter a valid number." };
    }
    return { value: parsed };
  }
  if (type === "boolean") {
    if (rawValue === "true") return { value: true };
    if (rawValue === "false") return { value: false };
    return { error: "Choose true or false." };
  }
  const parsed = Date.parse(rawValue);
  if (rawValue.trim() === "" || Number.isNaN(parsed)) {
    return { error: "Enter a valid date/time." };
  }
  return { value: new Date(parsed).toISOString() };
}

export function formatValueForInput(
  type: DashboardParameter["type"],
  value: ParameterValue | null | undefined,
): string {
  if (type === "boolean") {
    if (value === null || value === undefined) return "";
    return String(value);
  }
  return String(value ?? "");
}
