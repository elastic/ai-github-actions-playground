import Chip from "@mui/material/Chip";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import type { TaskRow } from "../services/es";

import { formatNanos, LONG_RUNNING_THRESHOLD_NS } from "./taskSortUtils";

const DESCRIPTION_TRUNCATE_LENGTH = 80;

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\u2026";
}

interface TaskTableRowProps {
  task: TaskRow;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function TaskTableRow({ task, selected, onSelect }: TaskTableRowProps) {
  return (
    <TableRow
      hover
      selected={selected}
      onClick={() => onSelect(task.taskId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(task.taskId);
        }
      }}
      tabIndex={0}
      aria-label={`View task ${task.taskId}`}
      sx={{ cursor: "pointer" }}
    >
      <TableCell>
        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
          {task.taskId}
        </Typography>
      </TableCell>
      <TableCell>{task.action}</TableCell>
      <TableCell>{task.type}</TableCell>
      <TableCell>{task.node}</TableCell>
      <TableCell>
        {task.description ? (
          <Tooltip
            title={task.description.length > DESCRIPTION_TRUNCATE_LENGTH ? task.description : ""}
            arrow
          >
            <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
              {truncate(task.description, DESCRIPTION_TRUNCATE_LENGTH)}
            </Typography>
          </Tooltip>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
            —
          </Typography>
        )}
      </TableCell>
      <TableCell>{new Date(task.startTimeMs).toLocaleString()}</TableCell>
      <TableCell>
        <Typography
          variant="body2"
          sx={{
            fontWeight: task.runningTimeNanos >= LONG_RUNNING_THRESHOLD_NS ? 700 : 400,
            color:
              task.runningTimeNanos >= LONG_RUNNING_THRESHOLD_NS ? "warning.main" : "text.primary",
          }}
        >
          {formatNanos(task.runningTimeNanos)}
        </Typography>
      </TableCell>
      <TableCell>
        {task.cancellable ? (
          <Chip label="Yes" size="small" color="warning" variant="outlined" />
        ) : (
          <Chip label="No" size="small" variant="outlined" />
        )}
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
          {task.parentTaskId || "—"}
        </Typography>
      </TableCell>
    </TableRow>
  );
}
