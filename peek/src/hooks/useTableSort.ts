import { useCallback, useState } from "react";

interface UseTableSortOptions<F extends string> {
  /**
   * Override the initial sort direction for the default field only.
   * Useful when the default field should open in the opposite direction
   * from what new-field clicks use.
   */
  initialDirection?: "asc" | "desc";
  /**
   * Per-field default directions applied when switching to that field for the
   * first time. Falls back to `defaultDirection` when not specified.
   */
  fieldDefaults?: Partial<Record<F, "asc" | "desc">>;
}

/**
 * Shared hook for managing table sort state.
 *
 * Returns the current sort field/direction, a `handleSort` toggle, and a
 * `getSortLabelProps` helper that spreads directly onto MUI `<TableSortLabel>`.
 *
 * @param defaultField - The field to sort by initially.
 * @param defaultDirection - Direction to use when switching to a new field
 *   that has no entry in `options.fieldDefaults`. Defaults to `"asc"`.
 * @param options - Optional overrides: `initialDirection` for the starting
 *   direction of `defaultField`; `fieldDefaults` for per-field initial
 *   directions when that column is first clicked.
 *
 * @example
 * ```tsx
 * const { getSortLabelProps } = useTableSort<"name" | "size">("name");
 * // …
 * <TableSortLabel {...getSortLabelProps("name")}>Name</TableSortLabel>
 * ```
 */
export function useTableSort<F extends string>(
  defaultField: F,
  defaultDirection: "asc" | "desc" = "asc",
  options?: UseTableSortOptions<F>,
) {
  const [sortField, setSortField] = useState<F>(defaultField);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    options?.initialDirection ?? defaultDirection,
  );

  const getFieldDirection = useCallback(
    (field: F): "asc" | "desc" => options?.fieldDefaults?.[field] ?? defaultDirection,
    [defaultDirection, options?.fieldDefaults],
  );

  const handleSort = useCallback(
    (field: F) => {
      setSortField(field);
      setSortDirection((prev) =>
        sortField === field ? (prev === "asc" ? "desc" : "asc") : getFieldDirection(field),
      );
    },
    [sortField, getFieldDirection],
  );

  const getSortLabelProps = useCallback(
    (field: F) => ({
      active: sortField === field,
      direction: sortField === field ? sortDirection : getFieldDirection(field),
      onClick: () => handleSort(field),
    }),
    [sortField, sortDirection, getFieldDirection, handleSort],
  );

  return {
    sortField,
    sortDirection,
    handleSort,
    getSortLabelProps,
    setSortField,
    setSortDirection,
  };
}
