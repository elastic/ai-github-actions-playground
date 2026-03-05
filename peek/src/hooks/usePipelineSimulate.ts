import { useCallback, useEffect, useRef, useState } from "react";

import type { SimulateIngestPipelineResponse, ElasticsearchConnection } from "../services/es";

import { runConnectionRequest } from "./useConnectionRequest";

export interface PipelineSimulateResult {
  simulating: boolean;
  error: string | null;
  result: SimulateIngestPipelineResponse | null;
  simulate: (docs: Record<string, unknown>[], verbose: boolean) => void;
  reset: () => void;
}

export function usePipelineSimulate(
  connection: ElasticsearchConnection | null,
  pipelineName: string | undefined,
): PipelineSimulateResult {
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulateIngestPipelineResponse | null>(null);
  const requestSeqRef = useRef(0);

  const clearState = useCallback(() => {
    requestSeqRef.current += 1;
    setSimulating(false);
    setResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    clearState();
  }, [pipelineName, connection, clearState]);

  const reset = clearState;

  const simulate = useCallback(
    (docs: Record<string, unknown>[], verbose: boolean) => {
      if (!connection || !pipelineName) return;
      const requestId = ++requestSeqRef.current;
      setSimulating(true);
      setError(null);
      setResult(null);
      void (async () => {
        try {
          const { data, error: reqError } = await runConnectionRequest({
            connection,
            run: (client) => client.simulateIngestPipeline(pipelineName, docs, { verbose }),
          });
          if (requestId !== requestSeqRef.current) return;
          if (reqError !== null) {
            setError(reqError);
          } else if (data !== null) {
            setResult(data);
          }
        } finally {
          if (requestId === requestSeqRef.current) setSimulating(false);
        }
      })();
    },
    [connection, pipelineName],
  );

  return { simulating, error, result, simulate, reset };
}
