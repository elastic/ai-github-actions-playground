import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import type { EsqlResponse, ElasticsearchConnection } from "../../types";

import {
  buildServiceRecentTracesQuery,
  buildServiceRoutesQuery,
} from "./serviceDashboardQueryBuilder";

interface UseServiceDashboardQueriesParams {
  connection: ElasticsearchConnection | null;
  serviceName: string;
  timeFrom: string;
  timeTo: string;
}

export function useServiceDashboardQueries({
  connection,
  serviceName,
  timeFrom,
  timeTo,
}: UseServiceDashboardQueriesParams) {
  const queryClient = useQueryClient();

  const [routesSession] = useState(0);
  const routesQueryKey = useMemo(
    () => ["service-dashboard-routes", serviceName, routesSession] as const,
    [serviceName, routesSession],
  );
  const { data: routesResult = null } = useQuery<EsqlResponse | null>({
    queryKey: routesQueryKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setRoutesResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(routesQueryKey, result),
    [queryClient, routesQueryKey],
  );

  const [tracesSession] = useState(0);
  const tracesQueryKey = useMemo(
    () => ["service-dashboard-traces", serviceName, tracesSession] as const,
    [serviceName, tracesSession],
  );
  const { data: tracesResult = null } = useQuery<EsqlResponse | null>({
    queryKey: tracesQueryKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setTracesResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(tracesQueryKey, result),
    [queryClient, tracesQueryKey],
  );

  const latestRoutesQueryRef = useRef<string | null>(null);
  const latestTracesQueryRef = useRef<string | null>(null);

  const {
    runQuery: runRoutesQuery,
    loading: routesLoading,
    error: routesError,
    clearError: clearRoutesError,
  } = useEsqlQuery({
    connection,
    onSuccess: useCallback(
      (data: EsqlResponse, executedQuery: string) => {
        if (executedQuery !== latestRoutesQueryRef.current) return;
        setRoutesResult(data);
      },
      [setRoutesResult],
    ),
    onFailure: useCallback(
      (failedQuery: string) => {
        if (failedQuery !== latestRoutesQueryRef.current) return;
        setRoutesResult(null);
      },
      [setRoutesResult],
    ),
  });

  const {
    runQuery: runTracesQuery,
    loading: tracesLoading,
    error: tracesError,
    clearError: clearTracesError,
  } = useEsqlQuery({
    connection,
    onSuccess: useCallback(
      (data: EsqlResponse, executedQuery: string) => {
        if (executedQuery !== latestTracesQueryRef.current) return;
        setTracesResult(data);
      },
      [setTracesResult],
    ),
    onFailure: useCallback(
      (failedQuery: string) => {
        if (failedQuery !== latestTracesQueryRef.current) return;
        setTracesResult(null);
      },
      [setTracesResult],
    ),
  });

  const loading = routesLoading || tracesLoading;
  const error = routesError || tracesError;

  const clearLatestQueries = useCallback(() => {
    latestRoutesQueryRef.current = null;
    latestTracesQueryRef.current = null;
  }, []);

  const handleSearch = useCallback(() => {
    const filters = { serviceName, timeFrom, timeTo };
    const routesQuery = buildServiceRoutesQuery(filters);
    latestRoutesQueryRef.current = routesQuery.trim();
    runRoutesQuery(routesQuery);
    const tracesQuery = buildServiceRecentTracesQuery(filters);
    latestTracesQueryRef.current = tracesQuery.trim();
    runTracesQuery(tracesQuery);
  }, [runRoutesQuery, runTracesQuery, serviceName, timeFrom, timeTo]);

  const handleReset = useCallback(() => {
    if (loading) return;
    clearLatestQueries();
    clearRoutesError();
    clearTracesError();
    setRoutesResult(null);
    setTracesResult(null);
  }, [
    clearLatestQueries,
    clearRoutesError,
    clearTracesError,
    loading,
    setRoutesResult,
    setTracesResult,
  ]);

  return {
    clearLatestQueries,
    error,
    handleReset,
    handleSearch,
    loading,
    routesResult,
    tracesResult,
  };
}
