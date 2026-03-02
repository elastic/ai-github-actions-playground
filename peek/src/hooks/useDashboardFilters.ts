import { useCallback, useEffect, useMemo, useRef } from "react";
import { parseAsBoolean, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

import type { DashboardDefinition } from "../types";

const dashboardFilterParsers = {
  q: parseAsString,
  tags: parseAsString,
  sort: parseAsStringEnum(["updated", "title"]).withDefault("updated"),
  archived: parseAsBoolean,
  favorites: parseAsBoolean,
};

export function useDashboardFilters(dashboards: DashboardDefinition[]) {
  const [urlState, setUrlState] = useQueryStates(dashboardFilterParsers, {
    history: "replace",
  });

  const searchQuery = urlState.q ?? "";
  const selectedTags = useMemo(() => {
    const raw = urlState.tags;
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [urlState.tags]);
  const selectedTagsRef = useRef(selectedTags);
  useEffect(() => {
    selectedTagsRef.current = selectedTags;
  }, [selectedTags]);
  const sortField = urlState.sort;
  const showArchived = urlState.archived === true;
  const showFavoritesOnly = urlState.favorites === true;

  const setShowArchived = useCallback(
    (value: boolean) => {
      void setUrlState({ archived: value ? true : null });
    },
    [setUrlState],
  );

  const setShowFavoritesOnly = useCallback(
    (value: boolean) => {
      void setUrlState({ favorites: value ? true : null });
    },
    [setUrlState],
  );

  const setSearchQuery = useCallback(
    (value: string) => {
      void setUrlState({ q: value || null });
    },
    [setUrlState],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const current = selectedTagsRef.current;
      const updated = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      selectedTagsRef.current = updated;
      void setUrlState({ tags: updated.length > 0 ? updated.join(",") : null });
    },
    [setUrlState],
  );

  const setSortField = useCallback(
    (value: "updated" | "title") => {
      void setUrlState({ sort: value === "updated" ? null : value });
    },
    [setUrlState],
  );

  const hasActiveFilters = searchQuery !== "" || selectedTags.length > 0 || showFavoritesOnly;

  const resetFilters = useCallback(() => {
    void setUrlState({
      q: null,
      tags: null,
      sort: null,
      favorites: null,
      archived: showArchived ? true : null,
    });
  }, [setUrlState, showArchived]);

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
