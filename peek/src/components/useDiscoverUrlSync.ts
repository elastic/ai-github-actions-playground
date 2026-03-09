import { useEffect, useRef } from "react";
import type { useQueryStates } from "nuqs";
import { parseAsString } from "nuqs";

import { DEFAULT_DISCOVER_QUERY } from "../store/useQueryStore";

export const discoverSearchParsers = {
  q: parseAsString,
  fields: parseAsString,
  from: parseAsString,
  to: parseAsString,
};

export const discoverSearchUrlKeys = {
  q: "q",
  fields: "fields",
  from: "from",
  to: "to",
};

/** Serialize a field set to a comma-separated URL value, or null when empty. */
export function encodeFields(fields: Set<string>): string | null {
  if (fields.size === 0) return null;
  return Array.from(fields).join(",");
}

/** Deserialize a comma-separated field string back to a Set. */
export function decodeFields(raw: string | null): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean),
  );
}

interface DiscoverShareState {
  query: string;
  selectedFields: Set<string>;
  timeRange: { from: string; to: string };
}

export interface DiscoverUrlHydrationMeta {
  hasQuery: boolean;
  hasExplicitFields: boolean;
}

/** Build a shareable Discover URL from current in-memory state. */
export function buildDiscoverShareUrl(baseHref: string, state: DiscoverShareState): string {
  const url = new URL(baseHref);
  const isDefault = state.query === DEFAULT_DISCOVER_QUERY && state.selectedFields.size === 0;
  const trimmedQuery = state.query.trim();
  const qValue = isDefault || trimmedQuery.length === 0 ? null : state.query;
  const fieldsValue = encodeFields(state.selectedFields);

  if (qValue === null) url.searchParams.delete(discoverSearchUrlKeys.q);
  else url.searchParams.set(discoverSearchUrlKeys.q, qValue);

  if (fieldsValue === null) url.searchParams.delete(discoverSearchUrlKeys.fields);
  else url.searchParams.set(discoverSearchUrlKeys.fields, fieldsValue);

  url.searchParams.set(discoverSearchUrlKeys.from, state.timeRange.from);
  url.searchParams.set(discoverSearchUrlKeys.to, state.timeRange.to);
  return url.toString();
}

interface UseDiscoverUrlSyncOptions {
  /** Captured initial URL state (from first render). */
  initialUrlState: {
    q: string | null;
    fields: string | null;
    from: string | null;
    to: string | null;
  };
  /** Current session query (the last executed or edited query). */
  query: string;
  /** Current selected fields in the result table. */
  selectedFields: Set<string>;
  /** Current dashboard time range. */
  timeRange: { from: string; to: string };
  /** Set the session query in the store. */
  setQuery: (query: string) => void;
  /** Set selected fields in the store. */
  setSelectedFields: (fields: Set<string>) => void;
  /** Set the global time range. */
  setTimeRange: (range: { from: string; to: string }) => void;
  /** nuqs state setter for updating URL params. */
  setUrlState: ReturnType<typeof useQueryStates<typeof discoverSearchParsers>>[1];
  /** Callback invoked once after URL hydration so the page can auto-execute. */
  onHydrated?: (meta: DiscoverUrlHydrationMeta) => void;
}

export function useDiscoverUrlSync({
  initialUrlState,
  query,
  selectedFields,
  timeRange,
  setQuery,
  setSelectedFields,
  setTimeRange,
  setUrlState,
  onHydrated,
}: UseDiscoverUrlSyncOptions): void {
  const hasHydratedFromUrlRef = useRef(false);
  const skipInitialUrlSyncRef = useRef(true);
  const hadInitialUrlParamsRef = useRef(false);

  // Restore discover state from URL on first mount
  useEffect(() => {
    const hasUrlParams =
      initialUrlState.q !== null ||
      initialUrlState.fields !== null ||
      initialUrlState.from !== null ||
      initialUrlState.to !== null;
    hadInitialUrlParamsRef.current = hasUrlParams;

    if (!hasUrlParams) {
      hasHydratedFromUrlRef.current = true;
      return;
    }

    const decodedFields = decodeFields(initialUrlState.fields);
    const hasExplicitFields = initialUrlState.fields !== null && decodedFields.size > 0;

    const hydratedQuery =
      initialUrlState.q !== null && initialUrlState.q.trim().length > 0 ? initialUrlState.q : null;

    if (hydratedQuery !== null) {
      setQuery(hydratedQuery);
    }
    if (hasExplicitFields) {
      setSelectedFields(decodedFields);
    }
    if (initialUrlState.from && initialUrlState.to) {
      setTimeRange({ from: initialUrlState.from, to: initialUrlState.to });
    }

    hasHydratedFromUrlRef.current = true;
    onHydrated?.({
      hasQuery: hydratedQuery !== null,
      hasExplicitFields,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync app state → URL. Debounced to avoid pushing one history entry per
  // keystroke when the user types in the editor.
  useEffect(() => {
    if (!hasHydratedFromUrlRef.current) return;
    if (skipInitialUrlSyncRef.current) {
      skipInitialUrlSyncRef.current = false;
      if (hadInitialUrlParamsRef.current) return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const isDefault = query === DEFAULT_DISCOVER_QUERY && selectedFields.size === 0;
      const trimmedQuery = query.trim();
      void (async () => {
        try {
          await setUrlState({
            q: isDefault || trimmedQuery.length === 0 ? null : query,
            fields: encodeFields(selectedFields),
            from: timeRange.from,
            to: timeRange.to,
          });
        } catch (err: unknown) {
          if (!cancelled) console.error("Discover URL sync failed:", err);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selectedFields, timeRange, setUrlState]);
}
