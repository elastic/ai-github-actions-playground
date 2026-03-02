import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type { DashboardDefinition } from "../types";

export function useDashboardFilters(dashboards: DashboardDefinition[]) {
  const [searchParams, setSearchParams] = useSearchParams();

  const searchQuery = searchParams.get("q") ?? "";
  const selectedTags = useMemo(() => {
    const raw = searchParams.get("tags");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);
  const sortField = (searchParams.get("sort") ?? "updated") as "updated" | "title";
  const showArchived = searchParams.get("archived") === "true";
  const showFavoritesOnly = searchParams.get("favorites") === "true";

  const setShowArchived = useCallback(
    (value: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set("archived", "true");
          } else {
            next.delete("archived");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setShowFavoritesOnly = useCallback(
    (value: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set("favorites", "true");
          } else {
            next.delete("favorites");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSearchQuery = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set("q", value);
          } else {
            next.delete("q");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const current = (prev.get("tags") ?? "").split(",").filter(Boolean);
          const updated = current.includes(tag)
            ? current.filter((t) => t !== tag)
            : [...current, tag];
          if (updated.length > 0) {
            next.set("tags", updated.join(","));
          } else {
            next.delete("tags");
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setSortField = useCallback(
    (value: "updated" | "title") => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === "updated") {
            next.delete("sort");
          } else {
            next.set("sort", value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const hasActiveFilters = searchQuery !== "" || selectedTags.length > 0 || showFavoritesOnly;

  const resetFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams();
        // Preserve the archived param since it has its own dedicated toggle
        if (prev.get("archived") === "true") next.set("archived", "true");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

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
