import { useCallback } from "react";
import type { QueryFunction } from "@tanstack/react-query";

import { type ElasticsearchClient } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";

import { runConnectionRequest } from "./useConnectionRequest";

export function esQueryFn<T>(
  connection: ReturnType<typeof useConnectionStore.getState>["connection"],
  run: (client: ElasticsearchClient) => Promise<T>,
): QueryFunction<T> {
  return async () => {
    const { data, error } = await runConnectionRequest({ connection, run });
    if (error) throw new Error(error);
    if (data === null) throw new Error("No active Elasticsearch connection");
    return data;
  };
}

export function useEsQuery() {
  const connection = useConnectionStore((s) => s.connection);

  const createQueryFn = useCallback(
    <T>(run: (client: ElasticsearchClient) => Promise<T>) =>
      connection ? esQueryFn(connection, run) : undefined,
    [connection],
  );

  return { connection, createQueryFn };
}
