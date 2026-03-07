import { useQuery } from "@tanstack/react-query";

import type { ListTasksResponse, TaskRow } from "../services/es";
import type { DataFetchResult } from "../types/query";

import { useEsQuery, useRefetchOnConnectionChange } from "./useEsQuery";

function toTaskRows(response: ListTasksResponse): TaskRow[] {
  const tasks = response.tasks ?? [];
  return tasks.map((t) => ({
    taskId: `${t.node}:${t.id}`,
    node: t.node,
    action: t.action,
    type: t.type,
    description: t.description ?? "",
    startTimeMs: t.start_time_in_millis,
    runningTimeNanos: t.running_time_in_nanos,
    cancellable: t.cancellable,
    cancelled: t.cancelled ?? false,
    parentTaskId: t.parent_task_id ?? "",
    raw: t,
  }));
}

export function useTasks(): DataFetchResult<TaskRow[]> & { refresh: () => void } {
  const { connection, createQueryFn } = useEsQuery();
  const query = useQuery({
    queryKey: ["tasks", connection?.url],
    queryFn: createQueryFn((client) => client.listTasks()),
    enabled: Boolean(connection),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useRefetchOnConnectionChange(connection, query.refetch);

  const refresh = () => {
    void query.refetch();
  };

  const nodeFailureMessages =
    query.data?.node_failures?.map(
      (failure) => failure.reason ?? failure.type ?? "Task fetch failed on one or more nodes",
    ) ?? [];

  if (!connection) return { status: "idle", refresh };
  if (query.isFetching) return { status: "loading", refresh };
  if (query.isError) return { status: "error", error: query.error.message, refresh };
  if (nodeFailureMessages.length > 0) {
    return { status: "error", error: nodeFailureMessages.join("; "), refresh };
  }
  if (query.data) return { status: "success", data: toTaskRows(query.data), refresh };
  return { status: "idle", refresh };
}
