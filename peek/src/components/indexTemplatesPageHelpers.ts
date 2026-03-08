import {
  compareCompTpls,
  compareIndexTpls,
  type CompTplSortField,
  type IndexTplSortField,
  type SortDirection,
} from "./templatesSortUtils";
import type { ComponentTemplateRow, IndexTemplateRow } from "../services/es";

export const TEMPLATE_TABS: Array<"index" | "component"> = ["index", "component"];
export const INDEX_TPL_SORT_FIELDS: IndexTplSortField[] = [
  "name",
  "priority",
  "composedOfCount",
  "dataStream",
];
export const COMP_TPL_SORT_FIELDS: CompTplSortField[] = ["name", "usedByCount", "version"];
export const SORT_DIRECTIONS: SortDirection[] = ["asc", "desc"];

export const HIGH_PRIORITY_THRESHOLD = 500;

export function getNextSortDirection(
  currentField: string,
  currentDirection: SortDirection,
  nextField: string,
): SortDirection {
  return currentField === nextField && currentDirection === "asc" ? "desc" : "asc";
}

export function filterAndSortIndexTemplates({
  templates,
  search,
  dataStreamOnly,
  priorityMin,
  priorityMax,
  sortField,
  sortDirection,
}: {
  templates: IndexTemplateRow[];
  search: string;
  dataStreamOnly: boolean;
  priorityMin: string;
  priorityMax: string;
  sortField: IndexTplSortField;
  sortDirection: SortDirection;
}): IndexTemplateRow[] {
  const term = search.trim().toLowerCase();
  const minPriority = Number(priorityMin);
  const maxPriority = Number(priorityMax);
  const hasMin = priorityMin.trim() !== "" && Number.isFinite(minPriority);
  const hasMax = priorityMax.trim() !== "" && Number.isFinite(maxPriority);
  const filtered = templates.filter((template) => {
    if (dataStreamOnly && !template.dataStreamEnabled) return false;
    if (hasMin && template.priority < minPriority) return false;
    if (hasMax && template.priority > maxPriority) return false;
    if (!term) return true;
    return (
      template.name.toLowerCase().includes(term) ||
      template.indexPatterns.some((pattern) => pattern.toLowerCase().includes(term)) ||
      template.composedOf.some((component) => component.toLowerCase().includes(term))
    );
  });

  return [...filtered].sort((a, b) => compareIndexTpls(a, b, sortField, sortDirection));
}

export function filterAndSortComponentTemplates({
  templates,
  search,
  sortField,
  sortDirection,
}: {
  templates: ComponentTemplateRow[];
  search: string;
  sortField: CompTplSortField;
  sortDirection: SortDirection;
}): ComponentTemplateRow[] {
  const term = search.trim().toLowerCase();
  const filtered = templates.filter((template) => {
    if (!term) return true;
    return template.name.toLowerCase().includes(term);
  });

  return [...filtered].sort((a, b) => compareCompTpls(a, b, sortField, sortDirection));
}
