import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { EsqlResponse, ElasticsearchConnection } from "../../types";
import { buildColumnAccessor } from "../../services/es/columnUtils";
import { createPersesEsqlDatasource } from "../../services/perses/esqlDatasource";
import { parseSpansFromEsql, type Span } from "../traces/traceUtils";
import {
  buildTraceSpansForTraceIdsQuery,
  DEFAULT_FIELD_MAPPING,
} from "../traces/traceQueryBuilder";

import {
  buildServiceDeploymentsQuery,
  buildServiceK8sContextQuery,
  buildServiceRecentTracesQuery,
  buildServiceRouteSparklineQuery,
  buildServiceRoutesQuery,
} from "./serviceDashboardQueryBuilder";
import { type RouteSparklineData, parseRouteSparklineData } from "./serviceDashboardHelpers";

interface UseServiceDashboardQueriesParams {
  connection: ElasticsearchConnection | null;
  serviceName: string;
  timeFrom: string;
  timeTo: string;
}

/** Shared query key prefix for all service-dashboard queries. */
const KEY_PREFIX = "service-dashboard-" as const;

/** Shared options for all service-dashboard queries. */
const QUERY_OPTIONS = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

function isServiceDashboardQuery(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === "string" && queryKey[0].startsWith(KEY_PREFIX);
}

export function useServiceDashboardQueries({
  connection,
  serviceName,
  timeFrom,
  timeTo,
}: UseServiceDashboardQueriesParams) {
  const queryClient = useQueryClient();

  // Track the params that were active when handleReset was called.  When the
  // search params change, the mismatch automatically re-enables queries without
  // a setState-inside-useEffect.
  const [resetKey, setResetKey] = useState<string | null>(null);
  const paramsKey = `${serviceName}|${timeFrom}|${timeTo}`;
  const disabled = resetKey === paramsKey;

  const connectionUrl = connection?.url ?? null;
  const canFetch = !disabled && Boolean(connection) && serviceName.trim().length > 0;
  const filters = useMemo(
    () => ({ serviceName, timeFrom, timeTo }),
    [serviceName, timeFrom, timeTo],
  );

  // --- Routes ---
  const routesQuery = useQuery<EsqlResponse | null>({
    queryKey: [`${KEY_PREFIX}routes`, connectionUrl, serviceName, timeFrom, timeTo] as const,
    queryFn: async ({ signal }) => {
      if (!connection) return null;
      const query = buildServiceRoutesQuery(filters);
      return createPersesEsqlDatasource(connection).execute({ query: query.trim() }, signal);
    },
    enabled: canFetch,
    initialData: null,
    ...QUERY_OPTIONS,
  });

  // --- Traces ---
  const tracesQuery = useQuery<EsqlResponse | null>({
    queryKey: [`${KEY_PREFIX}traces`, connectionUrl, serviceName, timeFrom, timeTo] as const,
    queryFn: async ({ signal }) => {
      if (!connection) return null;
      const query = buildServiceRecentTracesQuery(filters);
      return createPersesEsqlDatasource(connection).execute({ query: query.trim() }, signal);
    },
    enabled: canFetch,
    initialData: null,
    ...QUERY_OPTIONS,
  });

  // Derive trace IDs from the traces result for the dependent trace-spans query.
  const traceIds = useMemo(() => {
    const data = tracesQuery.data;
    if (!data) return [];
    const get = buildColumnAccessor(data.columns);
    return Array.from(
      new Set(
        data.values
          .map((row) => String(get(row, DEFAULT_FIELD_MAPPING.traceId) ?? ""))
          .filter((id) => id.length > 0),
      ),
    );
  }, [tracesQuery.data]);

  // --- Trace Spans (dependent on traces) ---
  const traceSpansQuery = useQuery<EsqlResponse | null>({
    queryKey: [
      `${KEY_PREFIX}trace-spans`,
      connectionUrl,
      serviceName,
      timeFrom,
      timeTo,
      traceIds,
    ] as const,
    queryFn: async ({ signal }) => {
      if (!connection || traceIds.length === 0) return null;
      const query = buildTraceSpansForTraceIdsQuery(traceIds);
      return createPersesEsqlDatasource(connection).execute({ query: query.trim() }, signal);
    },
    enabled: canFetch && traceIds.length > 0,
    initialData: null,
    ...QUERY_OPTIONS,
  });

  // --- Deployments ---
  const deploymentsQuery = useQuery<EsqlResponse | null>({
    queryKey: [`${KEY_PREFIX}deployments`, connectionUrl, serviceName, timeFrom, timeTo] as const,
    queryFn: async ({ signal }) => {
      if (!connection) return null;
      const query = buildServiceDeploymentsQuery(filters);
      return createPersesEsqlDatasource(connection).execute({ query: query.trim() }, signal);
    },
    enabled: canFetch,
    initialData: null,
    ...QUERY_OPTIONS,
  });

  // --- Sparkline ---
  const sparklineQuery = useQuery<EsqlResponse | null>({
    queryKey: [`${KEY_PREFIX}sparkline`, connectionUrl, serviceName, timeFrom, timeTo] as const,
    queryFn: async ({ signal }) => {
      if (!connection) return null;
      const query = buildServiceRouteSparklineQuery(filters);
      return createPersesEsqlDatasource(connection).execute({ query: query.trim() }, signal);
    },
    enabled: canFetch,
    initialData: null,
    ...QUERY_OPTIONS,
  });

  // --- K8s Context ---
  const k8sContextQuery = useQuery<EsqlResponse | null>({
    queryKey: [`${KEY_PREFIX}k8s-context`, connectionUrl, serviceName, timeFrom, timeTo] as const,
    queryFn: async ({ signal }) => {
      if (!connection) return null;
      const query = buildServiceK8sContextQuery(filters);
      return createPersesEsqlDatasource(connection).execute({ query: query.trim() }, signal);
    },
    enabled: canFetch,
    initialData: null,
    ...QUERY_OPTIONS,
  });

  // --- Derived data ---
  const traceExplorerSpans = useMemo<Span[]>(() => {
    const data = traceSpansQuery.data;
    if (!data) return [];
    return parseSpansFromEsql(data.columns, data.values, DEFAULT_FIELD_MAPPING);
  }, [traceSpansQuery.data]);

  const routeSparklineData = useMemo<Record<string, RouteSparklineData>>(() => {
    const data = sparklineQuery.data;
    if (!data) return {};
    return parseRouteSparklineData(data);
  }, [sparklineQuery.data]);

  // --- Aggregated states ---
  const loading =
    routesQuery.isFetching ||
    tracesQuery.isFetching ||
    traceSpansQuery.isFetching ||
    deploymentsQuery.isFetching ||
    sparklineQuery.isFetching ||
    k8sContextQuery.isFetching;

  const error = useMemo(() => {
    const errors = [
      routesQuery.error,
      tracesQuery.error,
      traceSpansQuery.error,
      deploymentsQuery.error,
      sparklineQuery.error,
      k8sContextQuery.error,
    ];
    const first = errors.find((e) => e != null);
    if (!first) return null;
    return first instanceof Error ? first.message : String(first);
  }, [
    routesQuery.error,
    tracesQuery.error,
    traceSpansQuery.error,
    deploymentsQuery.error,
    sparklineQuery.error,
    k8sContextQuery.error,
  ]);

  // --- Actions ---
  const clearLatestQueries = useCallback(() => {
    // No-op: React Query handles staleness via query key changes.
  }, []);

  const handleSearch = useCallback(() => {
    setResetKey(null);
    void queryClient.invalidateQueries({
      predicate: (query) => isServiceDashboardQuery(query.queryKey),
    });
  }, [queryClient]);

  const handleReset = useCallback(() => {
    if (loading) return;
    setResetKey(paramsKey);
    queryClient.removeQueries({
      predicate: (query) => isServiceDashboardQuery(query.queryKey),
    });
  }, [loading, queryClient, paramsKey]);

  return {
    clearLatestQueries,
    deploymentsResult: deploymentsQuery.data ?? null,
    error,
    handleReset,
    handleSearch,
    k8sContextResult: k8sContextQuery.data ?? null,
    loading,
    routeSparklineData,
    traceExplorerLoading: traceSpansQuery.isFetching,
    traceExplorerSpans,
    routesResult: routesQuery.data ?? null,
    tracesResult: tracesQuery.data ?? null,
  };
}
