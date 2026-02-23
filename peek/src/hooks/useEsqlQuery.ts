import { useCallback, useEffect, useRef, useState } from "react";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import type { ElasticsearchConnection, EsqlResponse } from "../types";
import type { EsqlQueryParams } from "../services/es";
import { setLastQueryError, setLastQueryResult } from "../components/llmCompletionExtension";

interface UseEsqlQueryOptions {
  connection: ElasticsearchConnection | null;
  onSuccess: (data: EsqlResponse, executedQuery: string) => void;
  onFailure?: () => void;
  buildRequest?: (queryText: string) => EsqlQueryParams;
}

function getServerDurationMs(data: EsqlResponse): number | null {
  const took = (data as { took?: unknown }).took;
  return typeof took === "number" && Number.isFinite(took) ? took : null;
}

export function useEsqlQuery({
  connection,
  onSuccess,
  onFailure,
  buildRequest,
}: UseEsqlQueryOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [stepDurationsMs, setStepDurationsMs] = useState<Record<number, number>>({});
  const [lastRunDurationMs, setLastRunDurationMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const clearError = useCallback(() => setError(null), []);
  const clearTimings = useCallback(() => {
    setStepDurationsMs({});
    setLastRunDurationMs(null);
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const runQuery = useCallback(
    async (queryText: string, stepIndex: number | null = null) => {
      if (!connection || !queryText.trim()) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setActiveStep(stepIndex);
      setError(null);
      try {
        const client = new ElasticsearchClient(connection);
        const trimmedQuery = queryText.trim();
        const request = buildRequest ? buildRequest(trimmedQuery) : { query: trimmedQuery };
        const data = await client.query(request, controller.signal);
        if (requestId === requestIdRef.current && !controller.signal.aborted) {
          const serverDurationMs = getServerDurationMs(data);
          if (stepIndex === null) {
            setStepDurationsMs({});
            setLastRunDurationMs(serverDurationMs);
          } else if (serverDurationMs !== null) {
            setStepDurationsMs((prev) => ({ ...prev, [stepIndex]: serverDurationMs }));
          } else {
            setStepDurationsMs((prev) => {
              const next = { ...prev };
              delete next[stepIndex];
              return next;
            });
          }
          setLastQueryError(null);
          setLastQueryResult(trimmedQuery, data);
          onSuccess(data, trimmedQuery);
        }
      } catch (err) {
        if (
          requestId === requestIdRef.current &&
          !controller.signal.aborted &&
          !(err instanceof DOMException && err.name === "AbortError")
        ) {
          const errorMessage = isElasticsearchError(err) ? err.message : String(err);
          setError(errorMessage);
          setLastQueryError(errorMessage);
          onFailure?.();
        }
      }
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setActiveStep(null);
      }
    },
    [connection, onSuccess, onFailure, buildRequest],
  );

  return {
    runQuery,
    loading,
    error,
    activeStep,
    stepDurationsMs,
    lastRunDurationMs,
    clearError,
    clearTimings,
  };
}
