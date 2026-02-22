import { useCallback, useState } from "react";
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
  const clearError = useCallback(() => setError(null), []);

  const runQuery = useCallback(
    async (queryText: string, stepIndex: number | null = null) => {
      if (!connection || !queryText.trim()) return;
      setLoading(true);
      setActiveStep(stepIndex);
      setError(null);
      try {
        const client = new ElasticsearchClient(connection);
        const data = await client.query({ query: queryText.trim() });
        onSuccess(data);
      } catch (err) {
        setError(isElasticsearchError(err) ? err.message : String(err));
        onFailure?.();
      } finally {
        setLoading(false);
        setActiveStep(null);
      }
    },
    [connection, onSuccess, onFailure],
  );

  return { runQuery, loading, error, activeStep, clearError };
}
