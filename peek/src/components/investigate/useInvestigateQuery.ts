import { useCallback, useEffect, useRef, useState } from "react";

import { isUnknownColumnError } from "../../services/es/esqlErrors";
import { useEsqlQuery } from "../../hooks/useEsqlQuery";
import type { ElasticsearchConnection, EsqlResponse } from "../../types";

import {
  buildInvestigateQuery,
  investigateField,
  QUERY_FLAVOR_CHAIN,
} from "./investigateQueryBuilder";
import type { QueryFlavor } from "./investigateQueryBuilder";
import { INVESTIGATE_TAB_LABEL } from "./investigateUtils";
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
  /** True when all query flavors failed due to missing column mappings. */
  isColumnMappingError: boolean;
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

  // Incremented on every query failure so the retry effect fires reliably,
  // even when the error message is identical across flavors.
  const [failureSeq, setFailureSeq] = useState(0);

  // Stable ref to the current pending search so the retry effect can read it.
  const pendingRef = useRef<{ tab: InvestigateTab; entity: string } | null>(null);
  // Ref mirrors flavorIndex state but is updated synchronously inside the
  // retry effect so that back-to-back retries always see the latest value
  // (React state batching can delay the state update across renders).
  const flavorIndexRef = useRef(0);
  const onFailureRef = useRef(onFailure);
  onFailureRef.current = onFailure;

  const handleSuccess = useCallback(
    (data: EsqlResponse) => {
      onSuccess(data);
    },
    [onSuccess],
  );

  const handleQueryFailure = useCallback(() => {
    setFailureSeq((n) => n + 1);
  }, []);

  const {
    runQuery: runEsqlQuery,
    loading,
    error,
    clearError,
  } = useEsqlQuery({
    connection,
    onSuccess: handleSuccess,
    onFailure: handleQueryFailure,
  });

  // When a query fails, check if it's a column error we can retry.
  // Uses failureSeq (incremented via onFailure) instead of error alone,
  // so the effect fires even when the error message is identical across flavors.
  useEffect(() => {
    if (!failureSeq || !error || !pendingRef.current) return;

    if (!isUnknownColumnError(error)) {
      onFailureRef.current?.();
      return;
    }

    const currentFlavorIndex = flavorIndexRef.current;
    const nextIndex = currentFlavorIndex + 1;
    if (nextIndex >= QUERY_FLAVOR_CHAIN.length) {
      // Exhausted all flavors — surface the error.
      onFailureRef.current?.();
      return;
    }

    // Retry with the next flavor, clearing the error first so the UI stays clean.
    const nextFlavor = QUERY_FLAVOR_CHAIN[nextIndex]!;
    const { tab, entity } = pendingRef.current;
    setFlavorIndex(nextIndex);
    flavorIndexRef.current = nextIndex;
    setActiveFlavor(nextFlavor);
    clearError();
    runEsqlQuery(buildInvestigateQuery(tab, entity, nextFlavor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failureSeq]);

  const runQuery = useCallback(
    (tab: InvestigateTab, entity: string) => {
      pendingRef.current = { tab, entity };
      setFlavorIndex(0);
      flavorIndexRef.current = 0;
      setFailureSeq(0);
      setActiveFlavor(QUERY_FLAVOR_CHAIN[0]!);
      runEsqlQuery(buildInvestigateQuery(tab, entity, QUERY_FLAVOR_CHAIN[0]!));
    },
    [runEsqlQuery],
  );

  // During an in-flight retry, suppress the intermediate column error.
  const isRetrying =
    error !== null && isUnknownColumnError(error) && flavorIndex < QUERY_FLAVOR_CHAIN.length - 1;

  // All flavors exhausted with a column-mapping error — show a friendly message.
  const isColumnMappingError =
    error !== null && isUnknownColumnError(error) && flavorIndex >= QUERY_FLAVOR_CHAIN.length - 1;

  let displayError: string | null;
  if (isRetrying) {
    displayError = null;
  } else if (isColumnMappingError && pendingRef.current) {
    const label = INVESTIGATE_TAB_LABEL[pendingRef.current.tab];
    const field = investigateField(pendingRef.current.tab);
    displayError =
      `No security logs with ${label} information were found in this cluster. ` +
      `The field "${field}" does not exist in the queried indices.`;
  } else {
    displayError = error;
  }

  return {
    runQuery,
    loading,
    error: displayError,
    isColumnMappingError,
    activeFlavor,
  };
}
