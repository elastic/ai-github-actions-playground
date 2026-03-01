import { useCallback, useEffect, useRef, useState } from "react";

import type { IngestPipeline } from "../services/es";
import type { DataFetchResult } from "../types/query";
import { useConnectionStore } from "../store/useConnectionStore";

import { runConnectionRequest } from "./useConnectionRequest";

export type PipelineEntry = { name: string; pipeline: IngestPipeline };

export function useIngestPipelines(): DataFetchResult<PipelineEntry[]> & {
  refresh: () => void;
} {
  const connection = useConnectionStore((s) => s.connection);
  const [result, setResult] = useState<DataFetchResult<PipelineEntry[]>>({ status: "idle" });
  const inFlightRef = useRef(false);
  const requestSeqRef = useRef(0);

  const load = useCallback(
    async (abortInFlight = true) => {
      if (!connection) {
        inFlightRef.current = false;
        setResult({ status: "idle" });
        return;
      }
      if (!abortInFlight && inFlightRef.current) return;
      const seq = ++requestSeqRef.current;
      inFlightRef.current = true;
      setResult({ status: "loading" });
      try {
        const { data, error } = await runConnectionRequest({
          connection,
          run: (client) => client.getIngestPipelines(),
        });
        if (seq !== requestSeqRef.current) return;
        if (error !== null) {
          setResult({ status: "error", error });
        } else if (data !== null) {
          const entries = Object.entries(data)
            .map(([name, pipeline]) => ({ name, pipeline }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setResult({ status: "success", data: entries });
        }
      } finally {
        if (seq === requestSeqRef.current) {
          inFlightRef.current = false;
        }
      }
    },
    [connection],
  );

  useEffect(() => {
    void load();
    return () => {
      requestSeqRef.current++;
    };
  }, [load]);

  return { ...result, refresh: load };
}
