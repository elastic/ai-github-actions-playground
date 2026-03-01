import { useCallback, useEffect, useRef, useState } from "react";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import {
  loadElasticAgentInfo,
  loadElasticAgentLogs,
  loadElasticAgentMetrics,
  type ElasticAgentInfo,
  type ElasticAgentLogEntry,
  type ElasticAgentMetricPoint,
} from "../services/fleet";
import type { DataFetchResult } from "../types/query";
import { useConnectionStore } from "../store/useConnectionStore";

export interface FleetAgentDetailData {
  agentInfo: ElasticAgentInfo | null;
  logs: ElasticAgentLogEntry[];
  metrics: ElasticAgentMetricPoint[];
}

export function useFleetAgentDetail(agentId: string): DataFetchResult<FleetAgentDetailData> & {
  refresh: () => void;
} {
  const connection = useConnectionStore((s) => s.connection);
  const [result, setResult] = useState<DataFetchResult<FleetAgentDetailData>>({ status: "idle" });
  const inFlightRef = useRef(false);
  const requestSeqRef = useRef(0);

  const load = useCallback(
    async (abortInFlight = true) => {
      if (!connection || !agentId) {
        inFlightRef.current = false;
        setResult({ status: "idle" });
        return;
      }
      if (!abortInFlight && inFlightRef.current) return;
      const seq = ++requestSeqRef.current;
      inFlightRef.current = true;
      setResult({ status: "loading" });
      try {
        const client = new ElasticsearchClient(connection);
        const [agent, agentLogs, agentMetrics] = await Promise.all([
          loadElasticAgentInfo(client, agentId),
          loadElasticAgentLogs(client, agentId, { size: 200 }),
          loadElasticAgentMetrics(client, agentId, 60),
        ]);
        if (seq !== requestSeqRef.current) return;
        const fallbackAgent =
          !agent && (agentLogs.length > 0 || agentMetrics.length > 0)
            ? {
                agentId,
                hostname: agentId,
                version: "unknown",
                os: null,
                lastSeen: agentLogs[0]?.timestamp ?? agentMetrics[0]?.timestamp ?? "",
                logCount: agentLogs.length,
                errorCount: agentLogs.filter((entry) => entry.level.toLowerCase() === "error")
                  .length,
              }
            : null;
        setResult({
          status: "success",
          data: {
            agentInfo: agent ?? fallbackAgent,
            logs: agentLogs,
            metrics: agentMetrics,
          },
        });
      } catch (err) {
        if (seq !== requestSeqRef.current) return;
        setResult({
          status: "error",
          error: isElasticsearchError(err) ? err.message : String(err),
        });
      } finally {
        if (seq === requestSeqRef.current) {
          inFlightRef.current = false;
        }
      }
    },
    [connection, agentId],
  );

  useEffect(() => {
    void load();
    return () => {
      requestSeqRef.current++;
    };
  }, [load]);

  return { ...result, refresh: load };
}
