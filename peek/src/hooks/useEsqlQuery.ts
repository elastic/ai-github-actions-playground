import { useCallback, useEffect, useRef, useState } from "react";
import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import type { ElasticsearchConnection, EsqlResponse } from "../types";

interface UseEsqlQueryOptions {
  connection: ElasticsearchConnection | null;
  onSuccess: (data: EsqlResponse) => void;
  onFailure?: () => void;
}

export function useEsqlQuery({ connection, onSuccess, onFailure }: UseEsqlQueryOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const clearError = useCallback(() => setError(null), []);

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
        const data = await client.query({ query: queryText.trim() }, controller.signal);
        if (requestId === requestIdRef.current && !controller.signal.aborted) {
          onSuccess(data);
        }
      } catch (err) {
        if (
          requestId === requestIdRef.current &&
          !controller.signal.aborted &&
          !(err instanceof DOMException && err.name === "AbortError")
        ) {
          setError(isElasticsearchError(err) ? err.message : String(err));
          onFailure?.();
        }
      }
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setActiveStep(null);
      }
    },
    [connection, onSuccess, onFailure],
  );

  return { runQuery, loading, error, activeStep, clearError };
}
