import { useCallback, useMemo } from "react";
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  parseAsStringEnum,
  useQueryStates,
} from "nuqs";

import type { DashboardDefinition } from "../types";

const dashboardFilterParsers = {
  q: parseAsString.withDefault(""),
  tags: parseAsArrayOf(parseAsString, ",").withDefault([]),
  sort: parseAsStringEnum<"updated" | "title">(["updated", "title"]).withDefault("updated"),
  archived: parseAsBoolean.withDefault(false),
  favorites: parseAsBoolean.withDefault(false),
};

export function useDashboardFilters(dashboards: DashboardDefinition[]) {
  const [filterState, setFilterState] = useQueryStates(dashboardFilterParsers, {
    history: "replace",
  });

  const searchQuery = filterState.q;
  const selectedTags = filterState.tags;
  const sortField = filterState.sort;
  const showArchived = filterState.archived;
  const showFavoritesOnly = filterState.favorites;

  const setShowArchived = useCallback(
    (value: boolean) => {
      void setFilterState({ archived: value });
    },
    [setFilterState],
  );

  const setShowFavoritesOnly = useCallback(
    (value: boolean) => {
      void setFilterState({ favorites: value });
    },
    [setFilterState],
  );

  const setSearchQuery = useCallback(
    (value: string) => {
      void setFilterState({ q: value });
    },
    [setFilterState],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      void setFilterState((prev) => {
        const current = prev.tags;
        const updated = current.includes(tag)
          ? current.filter((t) => t !== tag)
          : [...current, tag];
        return { tags: updated };
      });
    },
    [setFilterState],
  );

  const setSortField = useCallback(
    (value: "updated" | "title") => {
      void setFilterState({ sort: value });
    },
    [setFilterState],
  );

  const hasActiveFilters = searchQuery !== "" || selectedTags.length > 0 || showFavoritesOnly;

  // Preserve the archived param since it has its own dedicated toggle
  const resetFilters = useCallback(() => {
    void setFilterState({
      q: null,
      tags: null,
      sort: null,
      favorites: null,
    });
  }, [setFilterState]);

  const hasFavorites = useMemo(() => dashboards.some((d) => d.favoritedAt), [dashboards]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const d of dashboards) {
      for (const t of d.tags ?? []) tagSet.add(t);
    }
    return Array.from(tagSet).sort();
  }, [dashboards]);

  const visibleDashboards = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = dashboards.filter((d) => {
      if (!showArchived && d.archived) return false;
      if (showFavoritesOnly && !d.favoritedAt) return false;
      if (
        q &&
        !d.title.toLowerCase().includes(q) &&
        !(d.description ?? "").toLowerCase().includes(q)
      )
        return false;
      if (selectedTags.length > 0 && !selectedTags.every((t) => (d.tags ?? []).includes(t)))
        return false;
      return true;
    });
    result = [...result].sort((a, b) => {
      // Favorites always rank first
      if (a.favoritedAt && !b.favoritedAt) return -1;
      if (!a.favoritedAt && b.favoritedAt) return 1;
      if (sortField === "title") return a.title.localeCompare(b.title);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return result;
  }, [dashboards, showArchived, showFavoritesOnly, searchQuery, selectedTags, sortField]);

  return {
    searchQuery,
    setSearchQuery,
    selectedTags,
    toggleTag,
    sortField,
    setSortField,
    showArchived,
    setShowArchived,
    showFavoritesOnly,
    setShowFavoritesOnly,
    hasActiveFilters,
    resetFilters,
    hasFavorites,
    allTags,
    visibleDashboards,
  };
}
