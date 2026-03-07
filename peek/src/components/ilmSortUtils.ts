import type { IlmIndexRow, IlmPolicyRow } from "../services/es";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IndexSortField = "index" | "policy" | "phase" | "step" | "age" | "error";
export type PolicySortField = "name" | "version" | "modifiedDate" | "indexCount";
export type SortDirection = "asc" | "desc";

// ---------------------------------------------------------------------------
// Duration parser
// ---------------------------------------------------------------------------

export function parseDurationToMs(value: string): number {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i);
  if (!match) return Number.POSITIVE_INFINITY;
  const [, amountText, unitText] = match;
  if (!amountText || !unitText) return Number.POSITIVE_INFINITY;
  const amount = Number(amountText);
  if (Number.isNaN(amount)) return Number.POSITIVE_INFINITY;
  const unit = unitText.toLowerCase();
  const factor =
    unit === "ms"
      ? 1
      : unit === "s"
        ? 1000
        : unit === "m"
          ? 60_000
          : unit === "h"
            ? 3_600_000
            : 86_400_000;
  return amount * factor;
}

// ---------------------------------------------------------------------------
// Comparators
// ---------------------------------------------------------------------------

export function compareIndexRows(
  a: IlmIndexRow,
  b: IlmIndexRow,
  field: IndexSortField,
  dir: SortDirection,
): number {
  let cmp: number;
  switch (field) {
    case "index":
      cmp = a.index.localeCompare(b.index);
      break;
    case "policy":
      cmp = a.policy.localeCompare(b.policy);
      break;
    case "phase":
      cmp = a.phase.localeCompare(b.phase);
      break;
    case "step":
      cmp = a.step.localeCompare(b.step);
      break;
    case "age":
      {
        const aMs = parseDurationToMs(a.age);
        const bMs = parseDurationToMs(b.age);
        const aMissing = !Number.isFinite(aMs);
        const bMissing = !Number.isFinite(bMs);
        if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
        cmp = aMs - bMs;
      }
      break;
    case "error":
      cmp = Number(a.isError) - Number(b.isError);
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

export function comparePolicyRows(
  a: IlmPolicyRow,
  b: IlmPolicyRow,
  field: PolicySortField,
  dir: SortDirection,
): number {
  let cmp: number;
  switch (field) {
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "version":
      cmp = a.version - b.version;
      break;
    case "modifiedDate":
      cmp = a.modifiedDate.localeCompare(b.modifiedDate);
      break;
    case "indexCount":
      cmp = a.indexCount - b.indexCount;
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}
