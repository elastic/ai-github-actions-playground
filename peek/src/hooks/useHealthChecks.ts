import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  buildHealthSnapshot,
  evaluateHealthChecks,
  HEALTH_SNAPSHOT_TTL_MS,
  healthRegistry,
} from "../health-checks";
import type { EvaluatedHealthCheck, HealthQueryGroup, HealthSurface } from "../health-checks";
import { ElasticsearchClient } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";

const SHARED_HEALTH_SNAPSHOT_KEY = "shared";

export interface UseHealthChecksOptions {
  surface: HealthSurface;
  checkIds?: string[];
}

export interface UseHealthChecksResult {
  checks: EvaluatedHealthCheck[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  lastUpdatedAt: string | null;
}

export function useHealthChecks(options: UseHealthChecksOptions): UseHealthChecksResult {
  const connection = useConnectionStore((s) => s.connection);

  const selectedChecks = useMemo(() => {
    const allSurfaceChecks = healthRegistry.getBySurface(options.surface);
    if (!options.checkIds || options.checkIds.length === 0) return allSurfaceChecks;
    const selected = new Set(options.checkIds);
    return allSurfaceChecks.filter((check) => selected.has(check.id));
  }, [options.surface, options.checkIds]);

  const sharedGroups = useMemo(() => {
    return Array.from(
      new Set(selectedChecks.flatMap((check) => check.dependsOn)),
    ) as HealthQueryGroup[];
  }, [selectedChecks]);

  const query = useQuery({
    queryKey: [
      "health-checks",
      connection?.url,
      SHARED_HEALTH_SNAPSHOT_KEY,
      sharedGroups.join(","),
    ],
    queryFn: async ({ signal }) => {
      if (!connection) throw new Error("No active Elasticsearch connection");
      const client = new ElasticsearchClient(connection);
      return buildHealthSnapshot(client, sharedGroups, signal);
    },
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: HEALTH_SNAPSHOT_TTL_MS,
    gcTime: HEALTH_SNAPSHOT_TTL_MS * 3,
  });

  const checks = useMemo(() => {
    if (!query.data) return [];
    return evaluateHealthChecks(selectedChecks, query.data);
  }, [selectedChecks, query.data]);

  const refresh = useCallback(() => {
    void query.refetch();
  }, [query.refetch]);

  return {
    checks,
    loading: query.isFetching,
    error: query.isError ? query.error.message : null,
    refresh,
    lastUpdatedAt: query.data?.fetchedAt ?? null,
  };
}
