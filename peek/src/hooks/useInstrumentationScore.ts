import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { EsqlResponse, ElasticsearchConnection } from "../types";
import { isElasticsearchError } from "../services/es";
import { createPersesEsqlDatasource } from "../services/perses/esqlDatasource";

import {
  type ServiceInstrumentationScore,
  INSTRUMENTATION_SCORE_RULES,
  buildInstrumentationScoreQuery,
  buildInternalSpanCountQuery,
  buildSpanNameCardinalityQuery,
  buildDuplicateInstanceIdQuery,
  evaluateInstrumentationScore,
} from "../instrumentation-score";
import { parseInstrumentationScoreResult } from "../instrumentation-score/snapshotParser";

interface UseInstrumentationScoreParams {
  connection: ElasticsearchConnection | null;
  serviceName: string;
  timeFrom: string;
  timeTo: string;
  enabled?: boolean;
}

const KEY_PREFIX = "instrumentation-score-" as const;

const QUERY_OPTIONS = {
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;
const RULES_REQUIRING_INTERNAL_SPAN_QUERY = new Set(["SPA-001", "SPA-005"]);
const RULES_REQUIRING_DUPLICATE_INSTANCE_QUERY = new Set(["RES-002"]);
const RULES_REQUIRING_SPAN_NAME_CARDINALITY_QUERY = new Set(["SPA-003"]);

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function getConnectionFingerprint(connection: ElasticsearchConnection | null): string | null {
  if (!connection) return null;
  return hashString(
    [
      connection.url,
      connection.apiKey ?? "",
      connection.username ?? "",
      connection.password ?? "",
      connection.proxyUrl ?? "",
    ].join("|"),
  );
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
  enabled = true,
}: UseInstrumentationScoreParams) {
  const connectionFingerprint = getConnectionFingerprint(connection);
  const normalizedServiceName = serviceName.trim();
  const canFetch = enabled && Boolean(connection) && normalizedServiceName.length > 0;

  const filters = useMemo(
    () => ({ serviceName: normalizedServiceName, timeFrom, timeTo }),
    [normalizedServiceName, timeFrom, timeTo],
  );
  const needsDuplicateInstanceQuery = INSTRUMENTATION_SCORE_RULES.some((rule) =>
    RULES_REQUIRING_DUPLICATE_INSTANCE_QUERY.has(rule.id),
  );
  const needsInternalSpanQuery = INSTRUMENTATION_SCORE_RULES.some((rule) =>
    RULES_REQUIRING_INTERNAL_SPAN_QUERY.has(rule.id),
  );
  const needsSpanNameCardinalityQuery = INSTRUMENTATION_SCORE_RULES.some((rule) =>
    RULES_REQUIRING_SPAN_NAME_CARDINALITY_QUERY.has(rule.id),
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
  const hasMainData = mainQuery.data != null && mainQuery.data.values.length > 0;

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
    enabled: canFetch && hasMainData && needsInternalSpanQuery,
    initialData: null,
    ...QUERY_OPTIONS,
  });

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
    enabled: canFetch && hasMainData && needsDuplicateInstanceQuery,
    initialData: null,
    ...QUERY_OPTIONS,
  });

  const spanNameCardinalityQuery = useQuery<EsqlResponse | null>({
    queryKey: [
      `${KEY_PREFIX}span-name-cardinality`,
      connectionFingerprint,
      normalizedServiceName,
      timeFrom,
      timeTo,
    ] as const,
    queryFn: async ({ signal }) => {
      if (!connection) return null;
      const query = buildSpanNameCardinalityQuery(filters);
      return createPersesEsqlDatasource(connection).execute({ query: query.trim() }, signal);
    },
    enabled: canFetch && hasMainData && needsSpanNameCardinalityQuery,
    initialData: null,
    ...QUERY_OPTIONS,
  });

  const loading =
    mainQuery.isFetching ||
    (needsInternalSpanQuery && internalSpanQuery.isFetching) ||
    duplicateInstanceQuery.isFetching ||
    spanNameCardinalityQuery.isFetching;

  const score: ServiceInstrumentationScore | null = useMemo(() => {
    if (!hasMainData) return null;
    if (needsInternalSpanQuery && internalSpanQuery.isFetching) return null;
    if (needsDuplicateInstanceQuery && duplicateInstanceQuery.isFetching) return null;
    if (needsSpanNameCardinalityQuery && spanNameCardinalityQuery.isFetching) return null;
    const snapshot = parseInstrumentationScoreResult(
      normalizedServiceName,
      mainQuery.data,
      needsInternalSpanQuery ? internalSpanQuery.data : null,
      needsSpanNameCardinalityQuery ? spanNameCardinalityQuery.data : null,
      needsDuplicateInstanceQuery ? duplicateInstanceQuery.data : null,
    );
    if (snapshot.totalSpanCount === 0) return null;
    return evaluateInstrumentationScore(INSTRUMENTATION_SCORE_RULES, snapshot);
  }, [
    normalizedServiceName,
    hasMainData,
    mainQuery.data,
    internalSpanQuery.data,
    internalSpanQuery.isFetching,
    needsInternalSpanQuery,
    duplicateInstanceQuery.data,
    duplicateInstanceQuery.isFetching,
    spanNameCardinalityQuery.data,
    spanNameCardinalityQuery.isFetching,
    needsSpanNameCardinalityQuery,
    needsDuplicateInstanceQuery,
  ]);

  const error = useMemo(() => {
    const first =
      mainQuery.error ??
      internalSpanQuery.error ??
      duplicateInstanceQuery.error ??
      spanNameCardinalityQuery.error;
    if (!first) return null;
    return formatUnknownError(first);
  }, [
    mainQuery.error,
    internalSpanQuery.error,
    duplicateInstanceQuery.error,
    spanNameCardinalityQuery.error,
  ]);

  return {
    score,
    loading,
    error,
  };
}

function formatUnknownError(error: unknown): string {
  if (isElasticsearchError(error)) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const topLevel = error as Record<string, unknown>;
    if (typeof topLevel.message === "string" && topLevel.message.length > 0) {
      return topLevel.message;
    }
    const nestedError = topLevel.error;
    if (typeof nestedError === "object" && nestedError !== null) {
      const nested = nestedError as Record<string, unknown>;
      if (typeof nested.reason === "string" && nested.reason.length > 0) return nested.reason;
      if (Array.isArray(nested.root_cause) && nested.root_cause.length > 0) {
        const firstRootCause = nested.root_cause[0];
        if (typeof firstRootCause === "object" && firstRootCause !== null) {
          const firstRootCauseReason = (firstRootCause as Record<string, unknown>).reason;
          if (typeof firstRootCauseReason === "string" && firstRootCauseReason.length > 0) {
            return firstRootCauseReason;
          }
        }
      }
    }
  }
  return String(error);
}
