import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { ElasticsearchClient } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { loadSecurityResource } from "../services/securityResourceLoader";

import { useRefetchOnConnectionChange } from "./useEsQuery";

export function useSecurityUsers() {
  const connection = useConnectionStore((s) => s.connection);
  const query = useQuery({
    queryKey: ["security-users", connection?.url],
    queryFn: async () => {
      if (!connection) {
        throw new Error("No active connection");
      }
      const client = new ElasticsearchClient(connection);
      return loadSecurityResource({
        client,
        fetchResource: (c) => c.getSecurityUsers(),
        canRead: (caps) => caps.canReadSecurityUsers,
        authDeniedNotice: "Your credentials cannot read all user data.",
      });
    },
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useRefetchOnConnectionChange(connection, query.refetch);

  const users = useMemo(() => {
    const data = query.data?.data;
    if (!data) return [];
    return Object.entries(data)
      .map(([username, user]) => ({
        username: user.username ?? username,
        enabled: user.enabled,
        roles: user.roles ?? [],
        full_name: user.full_name ?? null,
        email: user.email ?? null,
        metadata: user.metadata ?? {},
      }))
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [query.data]);

  const refresh = () => {
    if (!connection) return;
    void query.refetch();
  };

  return {
    users,
    loading: query.isFetching,
    error: query.data?.error ?? (query.isError ? query.error.message : null),
    accessNotice: query.data?.notice ?? null,
    refresh,
  };
}
