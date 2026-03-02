import { useCallback, useEffect, useRef } from "react";

import { isElasticsearchError } from "../services/es";
import {
  loadFleetServerStatus,
  loadFleetAgentVersions,
  loadFleetOutputHealth,
  loadElasticAgentInventory,
  loadFleetActions,
  loadFleetActionResults,
} from "../services/fleet";
import { useConnectionStore } from "../store/useConnectionStore";
import { useFleetStore } from "../store/useFleetStore";

import { runConnectionRequest } from "./useConnectionRequest";

const AUTO_REFRESH_MS = 30_000;

export function useFleetData() {
  const connection = useConnectionStore((s) => s.connection);

  const {
    setServerStatus,
    setAgentVersions,
    setOutputHealth,
    setAgentInventory,
    setAgentInventoryTotal,
    setActions,
    setActionResults,
    setLoading,
    setError,
    setPartialErrors,
    setLastUpdatedAt,
  } = useFleetStore.getState();

  const abortRef = useRef<AbortController | null>(null);

  const loadFleetData = useCallback(
    async (signal: AbortSignal) => {
      if (!connection) return;
      setLoading(true);
      setError(null);
      try {
        const { data: results, error } = await runConnectionRequest({
          connection,
          run: (client) =>
            Promise.allSettled([
              loadFleetServerStatus(client),
              loadFleetAgentVersions(client),
              loadFleetOutputHealth(client),
              loadElasticAgentInventory(client),
              loadFleetActions(client),
              loadFleetActionResults(client),
            ]),
        });
        if (signal.aborted) return;
        if (error !== null) {
          setError(error);
        } else if (results !== null) {
          const errors: string[] = [];
          const formatReason = (reason: unknown): string => {
            if (isElasticsearchError(reason)) return reason.message;
            if (reason instanceof Error) return reason.message;
            return String(reason);
          };
          const value = <T>(r: PromiseSettledResult<T>, label: string): T | null => {
            if (r.status === "fulfilled") return r.value;
            errors.push(`${label}: ${formatReason(r.reason)}`);
            return null;
          };

          setServerStatus(value(results[0]!, "Server status") ?? null);
          setAgentVersions(value(results[1]!, "Agent versions") ?? []);
          setOutputHealth(value(results[2]!, "Output health") ?? []);
          const inventoryResult = value(results[3]!, "Agent inventory");
          setAgentInventory(inventoryResult?.agents ?? []);
          setAgentInventoryTotal(inventoryResult?.total ?? 0);
          setActions(value(results[4]!, "Actions") ?? []);
          setActionResults(value(results[5]!, "Action results") ?? []);
          setPartialErrors(errors);
          if (results.some((result) => result.status === "fulfilled")) {
            setLastUpdatedAt(Date.now());
          }
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [
      connection,
      setLoading,
      setError,
      setServerStatus,
      setAgentVersions,
      setOutputHealth,
      setAgentInventory,
      setAgentInventoryTotal,
      setActions,
      setActionResults,
      setPartialErrors,
      setLastUpdatedAt,
    ],
  );

  const loadRef = useRef(loadFleetData);
  loadRef.current = loadFleetData;
  const runRefresh = useCallback(async (signal?: AbortSignal) => {
    const s = signal ?? abortRef.current?.signal;
    if (!s || s.aborted) return;
    await loadRef.current(s);
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void runRefresh(controller.signal);
    return () => {
      controller.abort();
    };
  }, [connection, runRefresh]);

  const autoRefreshEnabled = useFleetStore((s) => s.autoRefreshEnabled);
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const id = setInterval(() => {
      const s = abortRef.current?.signal;
      if (s && !s.aborted) void runRefresh(s);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefreshEnabled, runRefresh]);

  return { runRefresh };
}
