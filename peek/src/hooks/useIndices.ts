import { useCallback, useEffect, useRef, useState } from "react";

import type { CatIndexRecord, IndexStatsResponse } from "../services/es";
import type { DataFetchResult } from "../types/query";
import { useConnectionStore } from "../store/useConnectionStore";

import { runConnectionRequest } from "./useConnectionRequest";

export function useIndices(): DataFetchResult<CatIndexRecord[]> & {
  refresh: () => void;
} {
  const connection = useConnectionStore((s) => s.connection);
  const [result, setResult] = useState<DataFetchResult<CatIndexRecord[]>>({ status: "idle" });
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
          run: (client) => client.getCatIndices(),
        });
        if (seq !== requestSeqRef.current) return;
        if (error !== null) {
          setResult({ status: "error", error });
        } else if (data !== null) {
          const sorted = [...data].sort((a, b) => a.index.localeCompare(b.index));
          setResult({ status: "success", data: sorted });
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

export interface IndexDetailData {
  mappings: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  indexStats: IndexStatsResponse | null;
}

export function useIndexDetail(indexName: string | null): DataFetchResult<IndexDetailData> {
  const connection = useConnectionStore((s) => s.connection);
  const [result, setResult] = useState<DataFetchResult<IndexDetailData>>({ status: "idle" });
  const inFlightRef = useRef(false);
  const requestSeqRef = useRef(0);

  const loadDetail = useCallback(
    async (name: string, abortInFlight = true) => {
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
        const { data: results } = await runConnectionRequest({
          connection,
          run: (client) =>
            Promise.allSettled([
              client.getIndexMappings(name),
              client.getIndexSettings(name),
              client.getIndexStats(name),
            ]),
        });
        if (seq !== requestSeqRef.current) return;
        if (results !== null) {
          const [mappingsResult, settingsResult, statsResult] = results;
          setResult({
            status: "success",
            data: {
              mappings: mappingsResult.status === "fulfilled" ? mappingsResult.value : null,
              settings: settingsResult.status === "fulfilled" ? settingsResult.value : null,
              indexStats: statsResult.status === "fulfilled" ? statsResult.value : null,
            },
          });
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
    if (!indexName) {
      requestSeqRef.current++;
      inFlightRef.current = false;
      setResult({ status: "idle" });
      return;
    }
    void loadDetail(indexName);
    return () => {
      requestSeqRef.current++;
    };
  }, [indexName, loadDetail]);

  return result;
}
