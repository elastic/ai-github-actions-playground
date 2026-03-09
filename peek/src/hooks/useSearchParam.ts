import { parseAsString, useQueryState } from "nuqs";

/**
 * Shared hook for the `?search=` URL query parameter used across list pages.
 *
 * Replaces the identical `useQueryState("search", …)` snippet that was
 * duplicated in IndicesPage, DataStreamsPage, UsersPage, and RolesPage.
 */
export function useSearchParam() {
  return useQueryState("search", parseAsString.withDefault("").withOptions({ history: "replace" }));
}
