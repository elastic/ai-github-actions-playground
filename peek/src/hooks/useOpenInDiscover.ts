import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { PAGE_MANIFEST } from "../routes/manifest";
import { useQueryStore } from "../store/useQueryStore";

/**
 * Non-hook utility for imperative (non-React) contexts.
 * Sets the discover query draft and navigates to the Query Lab page.
 */
export function openInDiscover(navigate: (path: string) => void, query: string): void {
  useQueryStore.getState().setDiscoverQueryDraft(query);
  navigate(PAGE_MANIFEST.discover.path);
}

/**
 * React hook that returns a stable callback to set a draft ES|QL query
 * and navigate to the Query Lab (Discover) page.
 */
export function useOpenInDiscover(): (query: string) => void {
  const navigate = useNavigate();
  const setDiscoverQueryDraft = useQueryStore((s) => s.setDiscoverQueryDraft);

  return useCallback(
    (query: string) => {
      setDiscoverQueryDraft(query);
      navigate(PAGE_MANIFEST.discover.path);
    },
    [navigate, setDiscoverQueryDraft],
  );
}
