import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import { detectTelemetrySignals, type TelemetrySignal } from "../utils/addDataUtils";
import { useConnectionStore } from "../store/useConnectionStore";

const AUTO_POLL_INTERVAL_MS = 5_000;

export type VerifyStatus = "idle" | "checking" | "polling" | "found" | "not_found" | "error";

export interface IngestionVerificationResult {
  verifyStatus: VerifyStatus;
  foundSignals: Set<TelemetrySignal>;
  verifyError: string | null;
  handleVerifyIngestion: () => void;
  startPolling: () => void;
}

/**
 * Manages ingestion verification polling via React Query, replacing the manual
 * `setInterval` + `AbortController` + verify state machine in `AddDataPage`.
 *
 * Polling is enabled when verification is actively running and automatically
 * stops when signals are found or an error occurs.
 */
export function useIngestionVerification(): IngestionVerificationResult {
  const connection = useConnectionStore((s) => s.connection);
  const queryClient = useQueryClient();
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [connectionKey, setConnectionKey] = useState(connection?.url);

  // Reset when connection changes — this follows the React pattern for
  // adjusting state based on prop changes during render
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (connection?.url !== connectionKey) {
    setConnectionKey(connection?.url);
    setPollingEnabled(false);
    setHasTriggered(false);
  }

  useEffect(() => {
    queryClient.removeQueries({ queryKey: ["ingestion-verify"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionKey]);

  const query = useQuery({
    queryKey: ["ingestion-verify", connection?.url],
    queryFn: async ({ signal }): Promise<Set<TelemetrySignal>> => {
      if (!connection) throw new Error("No connection");
      const client = new ElasticsearchClient(connection);
      return detectTelemetrySignals(client, signal);
    },
    enabled: Boolean(connection && pollingEnabled),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: (query) => {
      if (query.state.error) return false;
      if (query.state.data && query.state.data.size > 0) return false;
      return AUTO_POLL_INTERVAL_MS;
    },
  });

  // Derive terminal states from query result — polling is considered
  // effectively stopped once signals are found or an error occurs.
  // React Query's refetchInterval callback handles the actual stop;
  // these derived booleans drive verifyStatus without needing setState.
  const signalsFound = Boolean(query.data && query.data.size > 0);
  const queryErrored = query.isError;
  const effectivelyPolling = pollingEnabled && !signalsFound && !queryErrored;

  const handleVerifyIngestion = useCallback(() => {
    queryClient.removeQueries({ queryKey: ["ingestion-verify"] });
    setPollingEnabled(true);
    setHasTriggered(true);
  }, [queryClient]);

  // Auto-start polling — called externally by AddDataPage when API key is generated
  const startPolling = useCallback(() => {
    setPollingEnabled((prev) => {
      if (!prev) setHasTriggered(true);
      return true;
    });
  }, []);

  // Derive verifyStatus from React Query state
  let verifyStatus: VerifyStatus = "idle";
  if (effectivelyPolling && query.isFetching && !query.data) {
    verifyStatus = "checking";
  } else if (queryErrored && hasTriggered) {
    verifyStatus = "error";
  } else if (signalsFound) {
    verifyStatus = "found";
  } else if (effectivelyPolling) {
    verifyStatus = "polling";
  } else if (query.data && query.data.size === 0 && !effectivelyPolling && hasTriggered) {
    verifyStatus = "not_found";
  }

  return {
    verifyStatus,
    foundSignals: query.data ?? new Set(),
    verifyError: queryErrored
      ? isElasticsearchError(query.error)
        ? query.error.message
        : String(query.error)
      : null,
    handleVerifyIngestion,
    startPolling,
  };
}
