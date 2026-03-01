import { useCallback, useState } from "react";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import type { DataFetchResult } from "../types/query";

export function useAddDataApiKey(): DataFetchResult<string> & {
  createKey: () => void;
} {
  const connection = useConnectionStore((s) => s.connection);
  const [result, setResult] = useState<DataFetchResult<string>>({ status: "idle" });

  const createKey = useCallback(async () => {
    if (!connection) return;
    setResult({ status: "loading" });
    try {
      const client = new ElasticsearchClient(connection);
      const response = await client.createApiKey({
        name: `peek-edot-${Date.now()}`,
        metadata: { managed_by: "elastic-peek", purpose: "edot-onboarding" },
      });
      setResult({ status: "success", data: response.encodedApiKey });
    } catch (err) {
      setResult({
        status: "error",
        error: isElasticsearchError(err) ? err.message : String(err),
      });
    }
  }, [connection]);

  return { ...result, createKey };
}
