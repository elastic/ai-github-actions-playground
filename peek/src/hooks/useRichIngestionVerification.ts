import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import { useConnectionStore } from "../store/useConnectionStore";
import type { TelemetrySignal } from "../utils/addDataUtils";
import {
  captureFullSnapshot,
  computeIngestionDelta,
  type IngestionSnapshot,
  type PerSignalDelta,
} from "../services/addData/ingestionQueries";

const POLL_INTERVAL_MS = 5_000;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RichVerifyStatus = "idle" | "capturing_baseline" | "polling" | "detected" | "error";

export interface IngestionVerificationState {
  status: RichVerifyStatus;
  baseline: IngestionSnapshot | null;
  current: IngestionSnapshot | null;
  deltas: PerSignalDelta[];
  /** True if any signal shows a new data stream, new hosts/agents, or meaningful volume changes. */
  overallDetected: boolean;
  /** Tier 1 data stream signals (from the latest poll). */
  dataStreamSignals: Set<TelemetrySignal>;
  error: string | null;
  /** Begin polling (captures baseline first if needed). */
  startPolling: () => void;
  /** Force an immediate poll cycle. */
  checkNow: () => void;
  /** Reset all verification state. */
  resetVerification: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRichIngestionVerification(
  expectedSignals: readonly TelemetrySignal[],
  hostOnboarding = false,
): IngestionVerificationState {
  const connection = useConnectionStore((s) => s.connection);
  const queryClient = useQueryClient();

  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [baseline, setBaseline] = useState<IngestionSnapshot | null>(null);

  // Reset polling and baseline whenever the connected cluster changes.
  // React 18 pattern: adjusting state during render triggers an immediate
  // re-render before children are painted, which is exactly what we want here.
  const [connectionKey, setConnectionKey] = useState(connection?.url);
  if (connection?.url !== connectionKey) {
    setConnectionKey(connection?.url);
    setPollingEnabled(false);
    setBaseline(null);
  }

  // Stable reference to expectedSignals for query functions — kept current without
  // making queries re-run every time the array reference changes.
  const expectedSignalsRef = useRef(expectedSignals);
  const hostOnboardingRef = useRef(hostOnboarding);
  useEffect(() => {
    expectedSignalsRef.current = expectedSignals;
    hostOnboardingRef.current = hostOnboarding;
  }, [expectedSignals, hostOnboarding]);

  // -----------------------------------------------------------------------
  // Baseline query — runs once when polling is enabled and baseline is null
  // -----------------------------------------------------------------------
  const baselineQuery = useQuery({
    queryKey: ["ingestion-baseline", connection?.url, hostOnboarding],
    queryFn: async ({ signal }) => {
      if (!connection) throw new Error("No active Elasticsearch connection");
      const client = new ElasticsearchClient(connection);
      const result = await captureFullSnapshot(
        client,
        expectedSignalsRef.current,
        signal,
        hostOnboardingRef.current,
      );
      if (!signal.aborted) setBaseline(result.snapshot);
      return result;
    },
    enabled: Boolean(connection && pollingEnabled && !baseline),
    retry: 1,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // -----------------------------------------------------------------------
  // Poll query — runs every 5s after baseline is captured
  // -----------------------------------------------------------------------
  const pollQuery = useQuery({
    queryKey: ["ingestion-poll", connection?.url, hostOnboarding],
    queryFn: async ({ signal }) => {
      if (!connection) throw new Error("No active Elasticsearch connection");
      const client = new ElasticsearchClient(connection);
      return captureFullSnapshot(
        client,
        expectedSignalsRef.current,
        signal,
        hostOnboardingRef.current,
      );
    },
    enabled: Boolean(connection && pollingEnabled && baseline),
    refetchInterval: () => POLL_INTERVAL_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // -----------------------------------------------------------------------
  // Derive deltas and status
  // -----------------------------------------------------------------------
  const current = pollQuery.data?.snapshot ?? null;
  const dataStreamSignals =
    pollQuery.data?.dataStreamSignals ??
    baselineQuery.data?.dataStreamSignals ??
    new Set<TelemetrySignal>();

  const deltas = baseline && current ? computeIngestionDelta(baseline, current) : [];

  const overallDetected = deltas.some((d) => d.signalDetected);

  // Status derivation
  const anyError = baselineQuery.isError || pollQuery.isError;
  let status: RichVerifyStatus = "idle";
  if (anyError) {
    status = "error";
  } else if (connection && pollingEnabled && !baseline) {
    status = "capturing_baseline";
  } else if (overallDetected) {
    status = "detected";
  } else if (pollingEnabled && baseline) {
    status = "polling";
  }

  const errorMessage = anyError ? formatError(baselineQuery.error ?? pollQuery.error) : null;

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  const startPolling = useCallback(() => {
    setPollingEnabled(true);
  }, []);

  const checkNow = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["ingestion-poll"] });
  }, [queryClient]);

  const resetVerification = useCallback(() => {
    queryClient.removeQueries({ queryKey: ["ingestion-baseline"] });
    queryClient.removeQueries({ queryKey: ["ingestion-poll"] });
    setPollingEnabled(false);
    setBaseline(null);
  }, [queryClient]);

  return {
    status,
    baseline,
    current,
    deltas,
    overallDetected,
    dataStreamSignals,
    error: errorMessage,
    startPolling,
    checkNow,
    resetVerification,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatError(error: unknown): string {
  if (isElasticsearchError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}
