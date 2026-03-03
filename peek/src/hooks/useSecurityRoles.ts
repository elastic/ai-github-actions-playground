import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { ElasticsearchClient, type SecurityRole, type SecurityUser } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import { loadSecurityResource } from "../services/securityResourceLoader";

import { useRefetchOnConnectionChange } from "./useEsQuery";

export type RoleEntry = { name: string; role: SecurityRole };

export function useSecurityRoles() {
  const connection = useConnectionStore((s) => s.connection);
  const rolesQuery = useQuery({
    queryKey: ["security-roles", connection?.url],
    queryFn: async () => {
      if (!connection) {
        throw new Error("No active Elasticsearch connection");
      }
      const client = new ElasticsearchClient(connection);
      return loadSecurityResource({
        client,
        fetchResource: (c) => c.getSecurityRoles(),
        canRead: (caps) => caps.canReadSecurityRoles,
        authDeniedNotice: "Your credentials cannot read all role data.",
      });
    },
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const usersQuery = useQuery({
    queryKey: ["security-role-users", connection?.url],
    queryFn: async () => {
      if (!connection) {
        throw new Error("No active Elasticsearch connection");
      }
      const client = new ElasticsearchClient(connection);
      return client.getSecurityUsers();
    },
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useRefetchOnConnectionChange(connection, rolesQuery.refetch);
  useRefetchOnConnectionChange(connection, usersQuery.refetch);

  const roles: RoleEntry[] = useMemo(() => {
    const data = rolesQuery.data?.data;
    if (!data) return [];
    return Object.entries(data)
      .map(([name, role]) => ({ name, role }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rolesQuery.data]);

  const users: SecurityUser[] = useMemo(() => {
    if (!usersQuery.data) return [];
    return Object.entries(usersQuery.data).map(([username, user]) => ({
      username: user.username ?? username,
      enabled: user.enabled,
      roles: user.roles ?? [],
    }));
  }, [usersQuery.data]);

  const usersError = usersQuery.isError ? usersQuery.error.message : null;

  const refresh = () => {
    if (!connection) return;
    void rolesQuery.refetch();
    void usersQuery.refetch();
  };

  return {
    roles,
    users,
    loading: rolesQuery.isFetching || usersQuery.isFetching,
    error: rolesQuery.data?.error ?? (rolesQuery.isError ? rolesQuery.error.message : null),
    accessNotice: rolesQuery.data?.notice ?? null,
    usersError,
    refresh,
  };
}
