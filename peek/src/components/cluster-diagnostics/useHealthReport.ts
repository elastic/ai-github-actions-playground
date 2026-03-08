import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ElasticsearchClient,
  isElasticsearchError,
  type HealthReportResponse,
} from "../../services/es";
import { useConnectionStore } from "../../store/useConnectionStore";

export function useHealthReport() {
  const connection = useConnectionStore((s) => s.connection);
  const queryClient = useQueryClient();
  const connUrl = connection?.url;

  const {
    data: report,
    isLoading: loading,
    error: queryError,
  } = useQuery<HealthReportResponse>({
    queryKey: ["health-report", connUrl],
    queryFn: ({ signal }) => new ElasticsearchClient(connection!).getHealthReport(signal),
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["health-report"] });
  }, [queryClient]);

  const error = useMemo(() => {
    if (!queryError) return null;
    if (isElasticsearchError(queryError)) {
      if (queryError.status === 400 || queryError.status === 404) {
        return "Health Report API is not available. This feature requires Elasticsearch 8.7 or later.";
      }
      return queryError.message;
    }
    return queryError instanceof Error ? queryError.message : "Failed to load health report";
  }, [queryError]);

  return { report, loading, error, refresh };
}
