import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import type { DataFetchResult } from "../types/query";

export function useAddDataApiKey(): DataFetchResult<string> & {
  createKey: () => void;
} {
  const connection = useConnectionStore((s) => s.connection);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!connection) throw new Error("No active Elasticsearch connection");
      const client = new ElasticsearchClient(connection);
      const response = await client.createApiKey({
        name: `peek-edot-${Date.now()}`,
        metadata: { managed_by: "elastic-peek", purpose: "edot-onboarding" },
      });
      return response.encodedApiKey;
    },
  });

  const createKey = useCallback(() => {
    if (!connection) return;
    mutation.mutate();
  }, [connection, mutation]);

  if (mutation.isPending) return { status: "loading", createKey };
  if (mutation.isError) {
    return {
      status: "error",
      error: isElasticsearchError(mutation.error) ? mutation.error.message : String(mutation.error),
      createKey,
    };
  }
  if (mutation.isSuccess) return { status: "success", data: mutation.data, createKey };
  return { status: "idle", createKey };
}
