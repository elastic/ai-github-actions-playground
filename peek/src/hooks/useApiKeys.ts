import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { ElasticsearchClient } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { loadSecurityResource } from "../services/securityResourceLoader";

import { useRefetchOnConnectionChange } from "./useEsQuery";

export function useApiKeys() {
  const connection = useConnectionStore((s) => s.connection);
  const query = useQuery({
    queryKey: ["security-api-keys", connection?.url],
    queryFn: async () => {
      if (!connection) {
        throw new Error("No active connection");
      }
      const client = new ElasticsearchClient(connection);
      return loadSecurityResource({
        client,
        fetchResource: (c) => c.getApiKeys(),
        canRead: (caps) => caps.canReadApiKeys,
        authDeniedNotice: "Your credentials cannot list API keys.",
      });
    },
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useRefetchOnConnectionChange(connection, query.refetch);

  const keys = useMemo(() => {
    const apiKeys = query.data?.data?.api_keys;
    if (!apiKeys) return [];
    return [...apiKeys].sort((a, b) => a.name.localeCompare(b.name));
  }, [query.data]);

  const refresh = () => {
    if (!connection) return;
    void query.refetch();
  };

  return {
    keys,
    loading: query.isFetching,
    error: query.data?.error ?? (query.isError ? query.error.message : null),
    accessNotice: query.data?.notice ?? null,
    refresh,
  };
}
