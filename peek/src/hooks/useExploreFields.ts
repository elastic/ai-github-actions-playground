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

  return {
    fields: query.data ?? [],
    fieldsLoading: query.isFetching,
  };
}
