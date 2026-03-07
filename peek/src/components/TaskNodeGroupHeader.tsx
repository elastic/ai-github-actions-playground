import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

/** Total column count (must match the table in TaskManagerPage). */
export const TASK_TABLE_COLUMN_COUNT = 9;

interface NodeGroupHeaderProps {
  nodeName: string;
  taskCount: number;
  expanded: boolean;
  onToggle: () => void;
}

export function NodeGroupHeader({ nodeName, taskCount, expanded, onToggle }: NodeGroupHeaderProps) {
  return (
    <TableRow
      onClick={onToggle}
      sx={{
        cursor: "pointer",
        backgroundColor: "action.hover",
        "&:hover": { backgroundColor: "action.selected" },
      }}
    >
      <TableCell colSpan={TASK_TABLE_COLUMN_COUNT} sx={{ py: 0.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton
            size="small"
            aria-label={expanded ? "Collapse node group" : "Expand node group"}
          >
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {nodeName}
          </Typography>
          <Chip
            label={`${taskCount} task${taskCount !== 1 ? "s" : ""}`}
            size="small"
            variant="outlined"
          />
        </Box>
      </TableCell>
    </TableRow>
  );
}
