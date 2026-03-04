import { useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import type { EsqlResponse, ElasticsearchConnection } from "../../types";

import {
  buildClusterInventoryQuery,
  buildNamespaceInventoryQuery,
  buildPodInventoryQuery,
  buildPodDetailQuery,
  buildK8sLogsQuery,
  buildK8sTracesQuery,
  buildAllWorkloadsInventoryQuery,
  buildWorkloadInventoryQuery,
  type K8sQueryFilters,
  type WorkloadKind,
} from "./k8sQueryBuilder";

export type K8sDashboardEntity = "cluster" | "namespace" | "workload" | "pod";

interface UseK8sDashboardQueriesParams {
  connection: ElasticsearchConnection | null;
  entity: K8sDashboardEntity;
  entityName: string;
  /** Workload kind (only relevant when entity === "workload") */
  workloadKind?: string;
  timeFrom: string;
  timeTo: string;
}

const WORKLOAD_KINDS: ReadonlySet<string> = new Set([
  "deployment",
  "replicaset",
  "statefulset",
  "daemonset",
  "job",
  "cronjob",
]);

function toWorkloadKind(value?: string): WorkloadKind | undefined {
  return value && WORKLOAD_KINDS.has(value) ? (value as WorkloadKind) : undefined;
}

function buildEntityQuery(params: UseK8sDashboardQueriesParams): string {
  const filters: K8sQueryFilters = {
    timeFrom: params.timeFrom,
    timeTo: params.timeTo,
  };
  switch (params.entity) {
    case "cluster":
      filters.cluster = params.entityName;
      return buildNamespaceInventoryQuery(filters);
    case "namespace":
      filters.namespace = params.entityName;
      return buildPodInventoryQuery(filters);
    case "workload": {
      const workloadKind = toWorkloadKind(params.workloadKind);
      filters.workloadName = params.entityName;
      if (workloadKind) {
        filters.workloadKind = workloadKind;
        return buildWorkloadInventoryQuery(workloadKind, filters);
      }
      // Invalid or missing workloadKind on a detail route — fall back to
      // the all-workloads query scoped by workloadName so results are still
      // narrowed to the selected workload name.
      return buildAllWorkloadsInventoryQuery(filters);
    }
    case "pod":
      return buildPodDetailQuery(params.entityName, filters);
  }
}

function buildOverviewQuery(params: UseK8sDashboardQueriesParams): string {
  const filters: K8sQueryFilters = {
    timeFrom: params.timeFrom,
    timeTo: params.timeTo,
  };
  switch (params.entity) {
    case "cluster":
      filters.cluster = params.entityName;
      return buildClusterInventoryQuery(filters);
    case "namespace":
      filters.namespace = params.entityName;
      return buildNamespaceInventoryQuery(filters);
    case "workload": {
      const workloadKind = toWorkloadKind(params.workloadKind);
      filters.workloadName = params.entityName;
      if (workloadKind) {
        filters.workloadKind = workloadKind;
        return buildWorkloadInventoryQuery(workloadKind, filters);
      }
      return buildAllWorkloadsInventoryQuery(filters);
    }
    case "pod":
      return buildPodDetailQuery(params.entityName, filters);
  }
}

function buildLogsQueryForEntity(params: UseK8sDashboardQueriesParams): string {
  const base: K8sQueryFilters & { podName?: string } = {
    timeFrom: params.timeFrom,
    timeTo: params.timeTo,
  };
  switch (params.entity) {
    case "cluster":
      base.cluster = params.entityName;
      break;
    case "namespace":
      base.namespace = params.entityName;
      break;
    case "workload":
      base.workloadName = params.entityName;
      base.workloadKind = toWorkloadKind(params.workloadKind);
      break;
    case "pod":
      base.podName = params.entityName;
      break;
  }
  return buildK8sLogsQuery(base);
}

function buildTracesQueryForEntity(params: UseK8sDashboardQueriesParams): string {
  const base: K8sQueryFilters & { podName?: string } = {
    timeFrom: params.timeFrom,
    timeTo: params.timeTo,
  };
  switch (params.entity) {
    case "cluster":
      base.cluster = params.entityName;
      break;
    case "namespace":
      base.namespace = params.entityName;
      break;
    case "workload":
      base.workloadName = params.entityName;
      base.workloadKind = toWorkloadKind(params.workloadKind);
      break;
    case "pod":
      base.podName = params.entityName;
      break;
  }
  return buildK8sTracesQuery(base);
}

export function useK8sDashboardQueries(params: UseK8sDashboardQueriesParams) {
  const { connection, entity, entityName } = params;
  const queryClient = useQueryClient();
  const validatedWorkloadKind =
    entity === "workload" ? toWorkloadKind(params.workloadKind) : undefined;
  const invalidWorkloadKind =
    entity === "workload" && params.workloadKind && !validatedWorkloadKind;
  const workloadKeyPart = validatedWorkloadKind ?? "";

  // --- Overview query state ---
  const overviewQueryKey = useMemo(
    () => ["k8s-dashboard-overview", entity, workloadKeyPart, entityName] as const,
    [entity, workloadKeyPart, entityName],
  );
  const { data: overviewResult = null } = useQuery<EsqlResponse | null>({
    queryKey: overviewQueryKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setOverviewResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(overviewQueryKey, result),
    [queryClient, overviewQueryKey],
  );

  // --- Entity query state ---
  const entityQueryKey = useMemo(
    () => ["k8s-dashboard-entity", entity, workloadKeyPart, entityName] as const,
    [entity, workloadKeyPart, entityName],
  );
  const { data: entityResult = null } = useQuery<EsqlResponse | null>({
    queryKey: entityQueryKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setEntityResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(entityQueryKey, result),
    [queryClient, entityQueryKey],
  );

  // --- Logs query state ---
  const logsQueryKey = useMemo(
    () => ["k8s-dashboard-logs", entity, workloadKeyPart, entityName] as const,
    [entity, workloadKeyPart, entityName],
  );
  const { data: logsResult = null } = useQuery<EsqlResponse | null>({
    queryKey: logsQueryKey,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });
  const setLogsResult = useCallback(
    (result: EsqlResponse | null) => queryClient.setQueryData(logsQueryKey, result),
    [queryClient, logsQueryKey],
  );

  // --- Traces query state ---
  const tracesQueryKey = useMemo(
    () => ["k8s-dashboard-traces", entity, workloadKeyPart, entityName] as const,
    [entity, workloadKeyPart, entityName],
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

  // --- Refs for stale query tracking ---
  const latestOverviewRef = useRef<string | null>(null);
  const latestEntityRef = useRef<string | null>(null);
  const latestLogsRef = useRef<string | null>(null);
  const latestTracesRef = useRef<string | null>(null);

  // --- Query runners ---
  const {
    runQuery: runOverviewQuery,
    loading: overviewLoading,
    error: overviewError,
    clearError: clearOverviewError,
  } = useEsqlQuery({
    connection,
    onSuccess: useCallback(
      (data: EsqlResponse, executedQuery: string) => {
        if (executedQuery !== latestOverviewRef.current) return;
        setOverviewResult(data);
      },
      [setOverviewResult],
    ),
    onFailure: useCallback(
      (failedQuery: string) => {
        if (failedQuery !== latestOverviewRef.current) return;
        setOverviewResult(null);
      },
      [setOverviewResult],
    ),
  });

  const {
    runQuery: runEntityQuery,
    loading: entityLoading,
    error: entityError,
    clearError: clearEntityError,
  } = useEsqlQuery({
    connection,
    onSuccess: useCallback(
      (data: EsqlResponse, executedQuery: string) => {
        if (executedQuery !== latestEntityRef.current) return;
        setEntityResult(data);
      },
      [setEntityResult],
    ),
    onFailure: useCallback(
      (failedQuery: string) => {
        if (failedQuery !== latestEntityRef.current) return;
        setEntityResult(null);
      },
      [setEntityResult],
    ),
  });

  const {
    runQuery: runLogsQuery,
    loading: logsLoading,
    error: logsError,
    clearError: clearLogsError,
  } = useEsqlQuery({
    connection,
    onSuccess: useCallback(
      (data: EsqlResponse, executedQuery: string) => {
        if (executedQuery !== latestLogsRef.current) return;
        setLogsResult(data);
      },
      [setLogsResult],
    ),
    onFailure: useCallback(
      (failedQuery: string) => {
        if (failedQuery !== latestLogsRef.current) return;
        setLogsResult(null);
      },
      [setLogsResult],
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
        if (executedQuery !== latestTracesRef.current) return;
        setTracesResult(data);
      },
      [setTracesResult],
    ),
    onFailure: useCallback(
      (failedQuery: string) => {
        if (failedQuery !== latestTracesRef.current) return;
        setTracesResult(null);
      },
      [setTracesResult],
    ),
  });

  const loading = overviewLoading || entityLoading || logsLoading || tracesLoading;
  const error = overviewError || entityError || logsError || tracesError;

  const clearLatestQueries = useCallback(() => {
    latestOverviewRef.current = null;
    latestEntityRef.current = null;
    latestLogsRef.current = null;
    latestTracesRef.current = null;
  }, []);

  const handleSearch = useCallback(() => {
    if (invalidWorkloadKind) return;

    const overviewQuery = buildOverviewQuery(params);
    latestOverviewRef.current = overviewQuery.trim();
    runOverviewQuery(overviewQuery);

    const entQuery = buildEntityQuery(params);
    latestEntityRef.current = entQuery.trim();
    runEntityQuery(entQuery);

    const logsQuery = buildLogsQueryForEntity(params);
    latestLogsRef.current = logsQuery.trim();
    runLogsQuery(logsQuery);

    const tracesQuery = buildTracesQueryForEntity(params);
    latestTracesRef.current = tracesQuery.trim();
    runTracesQuery(tracesQuery);
  }, [params, invalidWorkloadKind, runOverviewQuery, runEntityQuery, runLogsQuery, runTracesQuery]);

  const handleReset = useCallback(() => {
    clearLatestQueries();
    clearOverviewError();
    clearEntityError();
    clearLogsError();
    clearTracesError();
    setOverviewResult(null);
    setEntityResult(null);
    setLogsResult(null);
    setTracesResult(null);
  }, [
    clearLatestQueries,
    clearOverviewError,
    clearEntityError,
    clearLogsError,
    clearTracesError,
    setOverviewResult,
    setEntityResult,
    setLogsResult,
    setTracesResult,
  ]);

  return {
    clearLatestQueries,
    overviewResult,
    entityResult,
    logsResult,
    tracesResult,
    loading,
    error: invalidWorkloadKind ? `Unrecognized workload kind: "${params.workloadKind}"` : error,
    handleSearch,
    handleReset,
  };
}
