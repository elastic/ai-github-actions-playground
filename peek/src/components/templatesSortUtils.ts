import type { IndexTemplateRow, ComponentTemplateRow } from "../services/es";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IndexTplSortField = "name" | "priority" | "composedOfCount" | "dataStream";
export type CompTplSortField = "name" | "usedByCount" | "version";
export type SortDirection = "asc" | "desc";

// ---------------------------------------------------------------------------
// Comparators
// ---------------------------------------------------------------------------

export function compareIndexTpls(
  a: IndexTemplateRow,
  b: IndexTemplateRow,
  field: IndexTplSortField,
  dir: SortDirection,
): number {
  let cmp: number;
  switch (field) {
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "priority":
      cmp = a.priority - b.priority;
      break;
    case "composedOfCount":
      cmp = a.composedOfCount - b.composedOfCount;
      break;
    case "dataStream":
      cmp = Number(a.dataStreamEnabled) - Number(b.dataStreamEnabled);
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}

export function compareCompTpls(
  a: ComponentTemplateRow,
  b: ComponentTemplateRow,
  field: CompTplSortField,
  dir: SortDirection,
): number {
  let cmp: number;
  switch (field) {
    case "name":
      cmp = a.name.localeCompare(b.name);
      break;
    case "usedByCount":
      cmp = a.usedByCount - b.usedByCount;
      break;
    case "version":
      {
        const aText = String(a.version);
        const bText = String(b.version);
        const aNum = Number(a.version);
        const bNum = Number(b.version);
        const aMissing = aText.trim() === "—";
        const bMissing = bText.trim() === "—";
        if (aMissing || bMissing) {
          return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
        }
        cmp =
          Number.isFinite(aNum) && Number.isFinite(bNum)
            ? aNum - bNum
            : aText.localeCompare(bText, undefined, { numeric: true });
      }
      break;
    default:
      cmp = 0;
  }
  return dir === "asc" ? cmp : -cmp;
}
