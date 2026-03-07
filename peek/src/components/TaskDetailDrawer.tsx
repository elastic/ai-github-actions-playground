import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";

import type { TaskRow } from "../services/es";

import { formatNanos } from "./taskSortUtils";

interface TaskDetailDrawerProps {
  task: TaskRow | null;
  onClose: () => void;
}

export function TaskDetailDrawer({ task, onClose }: TaskDetailDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={Boolean(task)}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", md: 560 },
          p: 1,
          backgroundColor: "background.default",
        },
      }}
    >
      {task && (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 1,
            }}
          >
            <Typography variant="subtitle1">Task Details</Typography>
            <IconButton size="small" aria-label="Close task details" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1, py: 1 }}>
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
          </Box>
        </>
      )}
    </Drawer>
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
