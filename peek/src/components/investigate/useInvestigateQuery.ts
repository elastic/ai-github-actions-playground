import { useCallback, useEffect, useRef, useState } from "react";

import { isUnknownColumnError } from "../../services/es/esqlErrors";
import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import type { ElasticsearchConnection, EsqlResponse } from "../../types";

import { buildInvestigateQuery, QUERY_FLAVOR_CHAIN } from "./investigateQueryBuilder";
import type { QueryFlavor } from "./investigateQueryBuilder";
import type { InvestigateTab } from "./investigateUtils";

interface UseInvestigateQueryOptions {
  connection: ElasticsearchConnection | null;
  onSuccess: (data: EsqlResponse) => void;
  onFailure?: () => void;
}

interface UseInvestigateQueryResult {
  runQuery: (tab: InvestigateTab, entity: string) => void;
  loading: boolean;
  error: string | null;
  /** The flavor that succeeded (or is currently being tried). Null before first search. */
  activeFlavor: QueryFlavor | null;
}

/**
 * Wraps useEsqlQuery with a query-flavor fallback chain for the Investigate tab.
 *
 * Tries the "full" flavor (all ECS fields) first. If the cluster returns an
 * "Unknown column" error — meaning the indices lack those field mappings — it
 * automatically retries with the next flavor in QUERY_FLAVOR_CHAIN ("otel",
 * then "minimal"), hiding the intermediate error from the UI.
 */
export function useInvestigateQuery({
  connection,
  onSuccess,
  onFailure,
}: UseInvestigateQueryOptions): UseInvestigateQueryResult {
  const [flavorIndex, setFlavorIndex] = useState(0);
  const [activeFlavor, setActiveFlavor] = useState<QueryFlavor | null>(null);

  // Stable ref to the current pending search so the retry effect can read it.
  const pendingRef = useRef<{ tab: InvestigateTab; entity: string } | null>(null);
  const onFailureRef = useRef(onFailure);
  onFailureRef.current = onFailure;

  const handleSuccess = useCallback(
    (data: EsqlResponse) => {
      onSuccess(data);
    },
    [onSuccess],
  );

  const {
    runQuery: runEsqlQuery,
    loading,
    error,
    clearError,
  } = useEsqlQuery({
    connection,
    onSuccess: handleSuccess,
  });

  // When the error changes, check if it's a column error we can retry.
  useEffect(() => {
    if (!error || !pendingRef.current) return;

    if (!isUnknownColumnError(error)) {
      onFailureRef.current?.();
      return;
    }

    const nextIndex = flavorIndex + 1;
    if (nextIndex >= QUERY_FLAVOR_CHAIN.length) {
      // Exhausted all flavors — surface the error.
      onFailureRef.current?.();
      return;
    }

    // Retry with the next flavor, clearing the error first so the UI stays clean.
    const nextFlavor = QUERY_FLAVOR_CHAIN[nextIndex]!;
    const { tab, entity } = pendingRef.current;
    setFlavorIndex(nextIndex);
    setActiveFlavor(nextFlavor);
    clearError();
    runEsqlQuery(buildInvestigateQuery(tab, entity, nextFlavor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const runQuery = useCallback(
    (tab: InvestigateTab, entity: string) => {
      pendingRef.current = { tab, entity };
      setFlavorIndex(0);
      setActiveFlavor(QUERY_FLAVOR_CHAIN[0]!);
      runEsqlQuery(buildInvestigateQuery(tab, entity, QUERY_FLAVOR_CHAIN[0]!));
    },
    [runEsqlQuery],
  );

  // During an in-flight retry, suppress the intermediate column error.
  const isRetrying =
    error !== null && isUnknownColumnError(error) && flavorIndex < QUERY_FLAVOR_CHAIN.length - 1;

  return {
    runQuery,
    loading,
    error: isRetrying ? null : error,
    activeFlavor,
  };
}
