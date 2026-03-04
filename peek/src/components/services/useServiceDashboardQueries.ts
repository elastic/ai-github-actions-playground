import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import type { EsqlResponse, ElasticsearchConnection } from "../../types";

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

  const [deploymentsSession] = useState(0);
  const deploymentsQueryKey = useMemo(
    () => ["service-dashboard-deployments", serviceName, deploymentsSession] as const,
    [serviceName, deploymentsSession],
  );
  const { data: deploymentsResult = null } = useQuery<EsqlResponse | null>({
    queryKey: deploymentsQueryKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setDeploymentsResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(deploymentsQueryKey, result),
    [queryClient, deploymentsQueryKey],
  );

  const [k8sContextSession] = useState(0);
  const k8sContextQueryKey = useMemo(
    () => ["service-dashboard-k8s-context", serviceName, k8sContextSession] as const,
    [serviceName, k8sContextSession],
  );
  const { data: k8sContextResult = null } = useQuery<EsqlResponse | null>({
    queryKey: k8sContextQueryKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setK8sContextResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(k8sContextQueryKey, result),
    [queryClient, k8sContextQueryKey],
  );

  const latestRoutesQueryRef = useRef<string | null>(null);
  const latestTracesQueryRef = useRef<string | null>(null);
  const latestDeploymentsQueryRef = useRef<string | null>(null);
  const latestSparklineQueryRef = useRef<string | null>(null);
  const latestK8sContextQueryRef = useRef<string | null>(null);
  const [routeSparklineData, setRouteSparklineData] = useState<Record<string, RouteSparklineData>>(
    {},
  );

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

  const {
    runQuery: runDeploymentsQuery,
    loading: deploymentsLoading,
    error: deploymentsError,
    clearError: clearDeploymentsError,
  } = useEsqlQuery({
    connection,
    onSuccess: useCallback(
      (data: EsqlResponse, executedQuery: string) => {
        if (executedQuery !== latestDeploymentsQueryRef.current) return;
        setDeploymentsResult(data);
      },
      [setDeploymentsResult],
    ),
    onFailure: useCallback(
      (failedQuery: string) => {
        if (failedQuery !== latestDeploymentsQueryRef.current) return;
        setDeploymentsResult(null);
      },
      [setDeploymentsResult],
    ),
  });

  const {
    runQuery: runSparklineQuery,
    loading: sparklineLoading,
    error: sparklineError,
    clearError: clearSparklineError,
  } = useEsqlQuery({
    connection,
    onSuccess: useCallback((data: EsqlResponse, executedQuery: string) => {
      if (executedQuery !== latestSparklineQueryRef.current) return;
      setRouteSparklineData(parseRouteSparklineData(data));
    }, []),
    onFailure: useCallback((failedQuery: string) => {
      if (failedQuery !== latestSparklineQueryRef.current) return;
      setRouteSparklineData({});
    }, []),
  });

  const {
    runQuery: runK8sContextQuery,
    loading: k8sContextLoading,
    error: k8sContextError,
    clearError: clearK8sContextError,
  } = useEsqlQuery({
    connection,
    onSuccess: useCallback(
      (data: EsqlResponse, executedQuery: string) => {
        if (executedQuery !== latestK8sContextQueryRef.current) return;
        setK8sContextResult(data);
      },
      [setK8sContextResult],
    ),
    onFailure: useCallback(
      (failedQuery: string) => {
        if (failedQuery !== latestK8sContextQueryRef.current) return;
        setK8sContextResult(null);
      },
      [setK8sContextResult],
    ),
  });

  const loading =
    routesLoading || tracesLoading || deploymentsLoading || sparklineLoading || k8sContextLoading;
  const error = routesError || tracesError || deploymentsError || sparklineError || k8sContextError;

  const clearLatestQueries = useCallback(() => {
    latestRoutesQueryRef.current = null;
    latestTracesQueryRef.current = null;
    latestDeploymentsQueryRef.current = null;
    latestSparklineQueryRef.current = null;
    latestK8sContextQueryRef.current = null;
  }, []);

  const handleSearch = useCallback(() => {
    const filters = { serviceName, timeFrom, timeTo };
    const routesQuery = buildServiceRoutesQuery(filters);
    latestRoutesQueryRef.current = routesQuery.trim();
    runRoutesQuery(routesQuery);
    const tracesQuery = buildServiceRecentTracesQuery(filters);
    latestTracesQueryRef.current = tracesQuery.trim();
    runTracesQuery(tracesQuery);
    const deploymentsQuery = buildServiceDeploymentsQuery(filters);
    latestDeploymentsQueryRef.current = deploymentsQuery.trim();
    runDeploymentsQuery(deploymentsQuery);
    const sparklineQuery = buildServiceRouteSparklineQuery(filters);
    latestSparklineQueryRef.current = sparklineQuery.trim();
    setRouteSparklineData({});
    runSparklineQuery(sparklineQuery);
    const k8sContextQuery = buildServiceK8sContextQuery(filters);
    latestK8sContextQueryRef.current = k8sContextQuery.trim();
    runK8sContextQuery(k8sContextQuery);
  }, [
    runRoutesQuery,
    runTracesQuery,
    runDeploymentsQuery,
    runSparklineQuery,
    runK8sContextQuery,
    serviceName,
    timeFrom,
    timeTo,
  ]);

  const handleReset = useCallback(() => {
    if (loading) return;
    clearLatestQueries();
    clearRoutesError();
    clearTracesError();
    clearDeploymentsError();
    clearSparklineError();
    clearK8sContextError();
    setRoutesResult(null);
    setTracesResult(null);
    setDeploymentsResult(null);
    setRouteSparklineData({});
    setK8sContextResult(null);
  }, [
    clearLatestQueries,
    clearRoutesError,
    clearTracesError,
    clearDeploymentsError,
    clearSparklineError,
    clearK8sContextError,
    loading,
    setRoutesResult,
    setTracesResult,
    setDeploymentsResult,
    setK8sContextResult,
  ]);

  return {
    clearLatestQueries,
    deploymentsResult,
    error,
    handleReset,
    handleSearch,
    k8sContextResult,
    loading,
    routeSparklineData,
    routesResult,
    tracesResult,
  };
}
