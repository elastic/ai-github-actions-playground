import { useCallback, useState } from "react";

/**
 * Shared hook for managing table sort state.
 *
 * Returns the current sort field/direction, a `handleSort` toggle, and a
 * `getSortLabelProps` helper that spreads directly onto MUI `<TableSortLabel>`.
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
) {
  const [sortField, setSortField] = useState<F>(defaultField);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(defaultDirection);

  const handleSort = useCallback(
    (field: F) => {
      setSortDirection((prev) => (sortField === field && prev === "asc" ? "desc" : "asc"));
      setSortField(field);
    },
    [sortField],
  );

  const getSortLabelProps = useCallback(
    (field: F) => ({
      active: sortField === field,
      direction: (sortField === field ? sortDirection : "asc") as "asc" | "desc",
      onClick: () => handleSort(field),
    }),
    [sortField, sortDirection, handleSort],
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
