import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { ClusterHealthData } from "../../hooks/useClusterHealthData";
import EmptyState from "../EmptyState";

import { groupPendingTasks } from "./clusterHealthUtils";
import InfoCard from "./InfoCard";

interface TaskBacklogViewProps {
  data: ClusterHealthData;
}

const PENDING_TASK_THRESHOLD = 10;
const QUEUE_TIME_THRESHOLD_MS = 60_000;
const PRIORITY_ORDER = ["IMMEDIATE", "URGENT", "HIGH", "NORMAL", "LOW", "LANGUID", "UNKNOWN"];

export default function TaskBacklogView({ data }: TaskBacklogViewProps) {
  const tasks = data.pendingTasks?.tasks ?? [];
  const pendingCount = tasks.length;
  const maxQueueMs = Math.max(0, ...tasks.map((t) => t.time_in_queue_millis ?? 0));
  const delayed = data.clusterHealth?.delayed_unassigned_shards ?? 0;
  const unassigned = data.clusterHealth?.unassigned_shards ?? 0;

  const instability =
    (pendingCount >= PENDING_TASK_THRESHOLD ? 1 : 0) +
    (maxQueueMs >= QUEUE_TIME_THRESHOLD_MS ? 1 : 0) +
    (unassigned > 0 ? 1 : 0);

  const grouped = groupPendingTasks(tasks);

  return (
    <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ flexWrap: "wrap" }}>
        <InfoCard
          title="Pending tasks"
          value={pendingCount.toString()}
          severity={pendingCount >= PENDING_TASK_THRESHOLD ? "warning" : undefined}
        />
        <InfoCard
          title="Longest queued task"
          value={`${Math.round(maxQueueMs / 1000)}s`}
          detail="time in queue"
          severity={maxQueueMs >= QUEUE_TIME_THRESHOLD_MS ? "warning" : undefined}
        />
        <InfoCard title="Delayed unassigned shards" value={delayed.toString()} />
        <InfoCard
          title="Instability signals"
          value={instability.toString()}
          detail="threshold violations (0-3)"
          severity={instability > 0 ? "warning" : undefined}
        />
      </Stack>

      {tasks.length > 0 ? (
        <>
          <Typography variant="body2" sx={{ mt: 3, mb: 1 }}>
            Tasks by Priority
          </Typography>
          {[
            ...PRIORITY_ORDER.filter((p) => grouped.has(p)),
            ...Array.from(grouped.keys())
              .filter((p) => !PRIORITY_ORDER.includes(p))
              .sort(),
          ].map((priority) => (
            <div key={priority}>
              <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
                {priority} ({grouped.get(priority)!.length})
              </Typography>
              {grouped.get(priority)!.map((task, idx) => {
                const taskKey = `${priority}:${task.insert_order ?? idx}:${task.source ?? "unknown"}`;
                return (
                  <Typography
                    key={taskKey}
                    variant="body2"
                    color="text.secondary"
                    sx={{ pl: 2, fontSize: "0.8rem", fontFamily: "monospace" }}
                  >
                    [{Math.round((task.time_in_queue_millis ?? 0) / 1000)}s] {task.source ?? "—"}
                  </Typography>
                );
              })}
            </div>
          ))}
        </>
      ) : (
        <EmptyState
          icon={<CheckCircleOutlineIcon sx={{ fontSize: 48 }} />}
          heading="No pending tasks"
          description="The cluster has no pending or active tasks right now. This is a healthy state."
        />
      )}
    </>
  );
}
