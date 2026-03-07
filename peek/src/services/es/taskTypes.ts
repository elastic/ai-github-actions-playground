// ---------------------------------------------------------------------------
// Task Management API types
// ---------------------------------------------------------------------------

/** A single task returned by GET /_tasks */
export interface TaskInfo {
  node: string;
  id: number;
  type: string;
  action: string;
  description?: string;
  start_time_in_millis: number;
  running_time_in_nanos: number;
  cancellable: boolean;
  cancelled?: boolean;
  parent_task_id?: string;
  headers?: Record<string, string>;
  status?: Record<string, unknown>;
}

/** Response from GET /_tasks?detailed=true&group_by=none */
export interface ListTasksResponse {
  tasks?: TaskInfo[];
  node_failures?: Array<{
    type?: string;
    reason?: string;
    node_id?: string;
  }>;
}

/** Flattened task row for the table. */
export interface TaskRow {
  taskId: string;
  node: string;
  action: string;
  type: string;
  description: string;
  startTimeMs: number;
  runningTimeNanos: number;
  cancellable: boolean;
  cancelled: boolean;
  parentTaskId: string;
  raw?: TaskInfo;
}
