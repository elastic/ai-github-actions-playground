import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import type { TaskRow } from "../services/es";

import DetailSurface from "./DetailSurface";
import { formatNanos } from "./taskSortUtils";

interface TaskDetailDrawerProps {
  task: TaskRow | null;
  onClose: () => void;
}

export function TaskDetailDrawer({ task, onClose }: TaskDetailDrawerProps) {
  return (
    <DetailSurface
      open={Boolean(task)}
      onClose={onClose}
      title="Task Details"
      ariaLabel="Close task details"
      bodySx={{ px: 1, py: 1 }}
    >
      {task && (
        <>
          <DetailField label="TASK ID" mono>
            {task.taskId}
          </DetailField>
          <DetailField label="ACTION">{task.action}</DetailField>
          <DetailField label="TYPE">{task.type}</DetailField>
          <DetailField label="NODE">{task.node}</DetailField>
          <DetailField label="DESCRIPTION">{task.description || "—"}</DetailField>
          <DetailField label="START TIME">
            {new Date(task.startTimeMs).toLocaleString()}
          </DetailField>
          <DetailField label="RUNNING TIME">{formatNanos(task.runningTimeNanos)}</DetailField>
          <DetailField label="CANCELLABLE">{task.cancellable ? "Yes" : "No"}</DetailField>

          {task.parentTaskId && (
            <DetailField label="PARENT TASK ID" mono>
              {task.parentTaskId}
            </DetailField>
          )}

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              RAW JSON
            </Typography>
            <Paper
              variant="outlined"
              sx={{ p: 1, maxHeight: 300, overflow: "auto", fontSize: "0.75rem" }}
            >
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {JSON.stringify(task.raw ?? task, null, 2)}
              </pre>
            </Paper>
          </Box>
        </>
      )}
    </DetailSurface>
  );
}

// ---------------------------------------------------------------------------
// Small helper to reduce repetition in the detail panel
// ---------------------------------------------------------------------------

function DetailField({
  label,
  mono,
  children,
}: {
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
        {label}
      </Typography>
      <Typography variant="body2" gutterBottom sx={mono ? { fontFamily: "monospace" } : undefined}>
        {children}
      </Typography>
    </>
  );
}
