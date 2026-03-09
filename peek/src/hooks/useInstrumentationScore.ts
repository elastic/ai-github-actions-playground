import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { EsqlResponse, ElasticsearchConnection } from "../types";
import { createPersesEsqlDatasource } from "../services/perses/esqlDatasource";

import {
  type ServiceInstrumentationScore,
  INSTRUMENTATION_SCORE_RULES,
  buildInstrumentationScoreQuery,
  buildInternalSpanCountQuery,
  buildDuplicateInstanceIdQuery,
  evaluateInstrumentationScore,
} from "../instrumentation-score";
import { parseInstrumentationScoreResult } from "../instrumentation-score/snapshotParser";

interface UseInstrumentationScoreParams {
  connection: ElasticsearchConnection | null;
  serviceName: string;
  timeFrom: string;
  timeTo: string;
}

const KEY_PREFIX = "instrumentation-score-" as const;

const QUERY_OPTIONS = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

function getConnectionFingerprint(connection: ElasticsearchConnection | null): string | null {
  if (!connection) return null;
  return [
    connection.url,
    connection.apiKey ?? "",
    connection.username ?? "",
    connection.password ?? "",
    connection.proxyUrl ?? "",
  ].join("|");
}

/**
 * Hook that fetches instrumentation quality data for a service and evaluates
 * it against the instrumentation score rules.
 */
export function useInstrumentationScore({
  connection,
  serviceName,
  timeFrom,
  timeTo,
}: UseInstrumentationScoreParams) {
  const connectionFingerprint = getConnectionFingerprint(connection);
  const normalizedServiceName = serviceName.trim();
  const canFetch = Boolean(connection) && normalizedServiceName.length > 0;

  const filters = useMemo(
    () => ({ serviceName: normalizedServiceName, timeFrom, timeTo }),
    [normalizedServiceName, timeFrom, timeTo],
  );

  const mainQuery = useQuery<EsqlResponse | null>({
    queryKey: [
      `${KEY_PREFIX}main`,
      connectionFingerprint,
      normalizedServiceName,
      timeFrom,
      timeTo,
    ] as const,
    queryFn: async ({ signal }) => {
      if (!connection) return null;
      const query = buildInstrumentationScoreQuery(filters);
      return createPersesEsqlDatasource(connection).execute({ query: query.trim() }, signal);
    },
    enabled: canFetch,
    initialData: null,
    ...QUERY_OPTIONS,
  });

  const internalSpanQuery = useQuery<EsqlResponse | null>({
    queryKey: [
      `${KEY_PREFIX}internal-spans`,
      connectionFingerprint,
      normalizedServiceName,
      timeFrom,
      timeTo,
    ] as const,
    queryFn: async ({ signal }) => {
      if (!connection) return null;
      const query = buildInternalSpanCountQuery(filters);
      return createPersesEsqlDatasource(connection).execute({ query: query.trim() }, signal);
    },
    enabled: canFetch,
    initialData: null,
    ...QUERY_OPTIONS,
  });

  const hasData = mainQuery.data != null && mainQuery.data.values.length > 0;
  const duplicateInstanceQuery = useQuery<EsqlResponse | null>({
    queryKey: [
      `${KEY_PREFIX}duplicate-instance-id`,
      connectionFingerprint,
      normalizedServiceName,
      timeFrom,
      timeTo,
    ] as const,
    queryFn: async ({ signal }) => {
      if (!connection) return null;
      const query = buildDuplicateInstanceIdQuery(filters);
      return createPersesEsqlDatasource(connection).execute({ query: query.trim() }, signal);
    },
    enabled: canFetch,
    initialData: null,
    ...QUERY_OPTIONS,
  });

  const loading =
    mainQuery.isFetching || internalSpanQuery.isFetching || duplicateInstanceQuery.isFetching;

  const score: ServiceInstrumentationScore | null = useMemo(() => {
    if (!hasData) return null;
    const snapshot = parseInstrumentationScoreResult(
      normalizedServiceName,
      mainQuery.data,
      internalSpanQuery.data,
      duplicateInstanceQuery.data,
    );
    if (snapshot.totalSpanCount === 0) return null;
    return evaluateInstrumentationScore(INSTRUMENTATION_SCORE_RULES, snapshot);
  }, [
    normalizedServiceName,
    hasData,
    mainQuery.data,
    internalSpanQuery.data,
    duplicateInstanceQuery.data,
  ]);

  const error = useMemo(() => {
    const first = mainQuery.error ?? internalSpanQuery.error ?? duplicateInstanceQuery.error;
    if (!first) return null;
    return first instanceof Error ? first.message : String(first);
  }, [mainQuery.error, internalSpanQuery.error, duplicateInstanceQuery.error]);

  return {
    score,
    loading,
    error,
  };
}
