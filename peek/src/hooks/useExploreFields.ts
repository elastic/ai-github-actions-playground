import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { listFields, type FieldInfo } from "../services/es";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

/**
 * Loads field metadata for the given index pattern using React Query.
 *
 * Replaces the manual `useEffect` + cancelled-flag pattern that previously
 * lived in `ExplorePage`.
 */
export function useExploreFields(indexPattern: string): {
  fields: FieldInfo[];
  fieldsLoading: boolean;
} {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["explore-fields", connection?.url, indexPattern],
    queryFn: createQueryFn((client) => listFields(client, indexPattern)),
    enabled: Boolean(connection && indexPattern),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useRefetchOnConnectionChange(connection, query.refetch);

  const fields = useMemo(() => {
    const all = query.data ?? [];
    if (all.length === 0) return all;

    // EDOT aliases many resource/attribute fields to root names (e.g.
    // resource.attributes.host.name -> host.name). When both are present,
    // keep the prefixed field and hide the duplicate root field.
    const ATTRIBUTE_PREFIXES = ["attributes.", "resource.attributes."] as const;
    const aliasedRootNames = new Set<string>();
    for (const field of all) {
      for (const prefix of ATTRIBUTE_PREFIXES) {
        if (field.name.startsWith(prefix)) {
          aliasedRootNames.add(field.name.slice(prefix.length));
          break;
        }
      }
    }

    return all.filter((field) => {
      const isPrefixed = ATTRIBUTE_PREFIXES.some((prefix) => field.name.startsWith(prefix));
      if (isPrefixed) return true;
      return !aliasedRootNames.has(field.name);
    });
  }, [query.data]);

  return {
    fields,
    fieldsLoading: query.isFetching,
  };
}
