import { useCallback, useDeferredValue, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import PendingActionsIcon from "@mui/icons-material/PendingActions";

import { useTasks } from "../hooks/useTasks";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";
import { OverviewInfoCard } from "./OverviewInfoCard";
import {
  compareTasks,
  formatNanos,
  LONG_RUNNING_THRESHOLD_NS,
  type SortField,
  type SortDirection,
} from "./taskSortUtils";

// Re-export so existing consumers still work
export { compareTasks, LONG_RUNNING_THRESHOLD_NS } from "./taskSortUtils";
export type { SortField, SortDirection } from "./taskSortUtils";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TaskManagerPage() {
  const result = useTasks();
  const loading = result.status === "loading";
  const tasks = result.status === "success" ? result.data : [];

  // Search
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  // Sort — default: longest running first
  const [sortField, setSortField] = useState<SortField>("runningTime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = useCallback(
    (field: SortField) => {
      setSortDirection((prev) => (sortField === field && prev === "asc" ? "desc" : "asc"));
      setSortField(field);
    },
    [sortField],
  );

  // Detail flyover
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.taskId === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  // Derived metrics
  const cancellableCount = useMemo(() => tasks.filter((t) => t.cancellable).length, [tasks]);
  const longRunningCount = useMemo(
    () => tasks.filter((t) => t.runningTimeNanos >= LONG_RUNNING_THRESHOLD_NS).length,
    [tasks],
  );
  const oldestNanos = useMemo(
    () => tasks.reduce((max, t) => Math.max(max, t.runningTimeNanos), 0),
    [tasks],
  );

  // Filter + sort
  const filteredTasks = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const filtered = tasks.filter((t) => {
      if (!term) return true;
      return (
        t.taskId.toLowerCase().includes(term) ||
        t.action.toLowerCase().includes(term) ||
        t.node.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term)
      );
    });
    return [...filtered].sort((a, b) => compareTasks(a, b, sortField, sortDirection));
  }, [tasks, deferredSearch, sortField, sortDirection]);

  if (result.status === "error") {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{result.error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Task Manager"
          actions={
            <Button
              size="small"
              variant="outlined"
              onClick={result.refresh}
              aria-label={loading ? "Refreshing tasks" : "Refresh tasks"}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        />
      </Paper>

      {/* KPI cards */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title="Running Tasks">
            <Typography variant="h5" component="p">
              {tasks.length}
            </Typography>
          </OverviewInfoCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title="Cancellable">
            <Typography variant="h5" component="p">
              {cancellableCount}
            </Typography>
          </OverviewInfoCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title="Long-Running (>60s)">
            <Typography variant="h5" component="p">
              {longRunningCount}
            </Typography>
          </OverviewInfoCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title="Oldest Task">
            <Typography variant="h5" component="p">
              {oldestNanos > 0 ? formatNanos(oldestNanos) : "—"}
            </Typography>
          </OverviewInfoCard>
        </Grid>
      </Grid>

      {/* Search */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <TextField
          size="small"
          placeholder="Filter tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
          aria-label="Filter tasks"
        />
      </Box>

      {/* Table */}
      <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <TableContainer>
          <Table size="small" stickyHeader aria-label="Task list">
            <TableHead>
              <TableRow>
                <TableCell>Task ID</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === "action"}
                    direction={sortField === "action" ? sortDirection : "asc"}
                    onClick={() => handleSort("action")}
                  >
                    Action
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === "type"}
                    direction={sortField === "type" ? sortDirection : "asc"}
                    onClick={() => handleSort("type")}
                  >
                    Type
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === "node"}
                    direction={sortField === "node" ? sortDirection : "asc"}
                    onClick={() => handleSort("node")}
                  >
                    Node
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === "startTime"}
                    direction={sortField === "startTime" ? sortDirection : "asc"}
                    onClick={() => handleSort("startTime")}
                  >
                    Start Time
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === "runningTime"}
                    direction={sortField === "runningTime" ? sortDirection : "asc"}
                    onClick={() => handleSort("runningTime")}
                  >
                    Running Time
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === "cancellable"}
                    direction={sortField === "cancellable" ? sortDirection : "asc"}
                    onClick={() => handleSort("cancellable")}
                  >
                    Cancellable
                  </TableSortLabel>
                </TableCell>
                <TableCell>Parent Task</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 0, border: 0 }}>
                    <LinearProgress />
                  </TableCell>
                </TableRow>
              )}
              {filteredTasks.map((task) => (
                <TableRow
                  key={task.taskId}
                  hover
                  selected={task.taskId === selectedTaskId}
                  onClick={() => setSelectedTaskId(task.taskId)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                    >
                      {task.taskId}
                    </Typography>
                  </TableCell>
                  <TableCell>{task.action}</TableCell>
                  <TableCell>{task.type}</TableCell>
                  <TableCell>{task.node}</TableCell>
                  <TableCell>{new Date(task.startTimeMs).toLocaleString()}</TableCell>
                  <TableCell>{formatNanos(task.runningTimeNanos)}</TableCell>
                  <TableCell>
                    {task.cancellable ? (
                      <Chip label="Yes" size="small" color="warning" variant="outlined" />
                    ) : (
                      <Chip label="No" size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                    >
                      {task.parentTaskId || "—"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredTasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ border: 0 }}>
                    <EmptyState
                      size="small"
                      icon={<PendingActionsIcon sx={{ fontSize: 28 }} />}
                      heading="No tasks found"
                      description={
                        search ? "Try adjusting your search filter." : "No running tasks."
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Detail flyover */}
      <Drawer
        anchor="right"
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTaskId(null)}
        PaperProps={{
          sx: {
            width: { xs: "100%", md: 560 },
            p: 1,
            backgroundColor: "background.default",
          },
        }}
      >
        {selectedTask && (
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
              <IconButton
                size="small"
                aria-label="Close task details"
                onClick={() => setSelectedTaskId(null)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1, py: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                TASK ID
              </Typography>
              <Typography variant="body2" gutterBottom sx={{ fontFamily: "monospace" }}>
                {selectedTask.taskId}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                ACTION
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedTask.action}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                TYPE
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedTask.type}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                NODE
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedTask.node}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                START TIME
              </Typography>
              <Typography variant="body2" gutterBottom>
                {new Date(selectedTask.startTimeMs).toLocaleString()}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                RUNNING TIME
              </Typography>
              <Typography variant="body2" gutterBottom>
                {formatNanos(selectedTask.runningTimeNanos)}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                CANCELLABLE
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedTask.cancellable ? "Yes" : "No"}
              </Typography>

              {selectedTask.description && (
                <>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    DESCRIPTION
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    {selectedTask.description}
                  </Typography>
                </>
              )}

              {selectedTask.parentTaskId && (
                <>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    PARENT TASK ID
                  </Typography>
                  <Typography variant="body2" gutterBottom sx={{ fontFamily: "monospace" }}>
                    {selectedTask.parentTaskId}
                  </Typography>
                </>
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
                    {JSON.stringify(selectedTask.raw ?? selectedTask, null, 2)}
                  </pre>
                </Paper>
              </Box>
            </Box>
          </>
        )}
      </Drawer>
    </Box>
  );
}
