import { Fragment, useCallback, useDeferredValue, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PendingActionsIcon from "@mui/icons-material/PendingActions";

import type { TaskRow } from "../services/es";
import { useTasks } from "../hooks/useTasks";

import EmptyState from "./EmptyState";
import PageHeader from "./PageHeader";
import { KpiCards } from "./TaskKpiCards";
import { NodeGroupHeader, TASK_TABLE_COLUMN_COUNT } from "./TaskNodeGroupHeader";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { TaskTableRow } from "./TaskTableRow";
import {
  compareTasks,
  LONG_RUNNING_THRESHOLD_NS,
  type SortField,
  type SortDirection,
} from "./taskSortUtils";

// Re-export so existing consumers still work
export { compareTasks, LONG_RUNNING_THRESHOLD_NS } from "./taskSortUtils";
export type { SortField, SortDirection } from "./taskSortUtils";

export default function TaskManagerPage() {
  const result = useTasks();
  const loading = result.status === "loading";
  const taskData = result.status === "success" ? result.data : undefined;
  const tasks = useMemo(() => taskData ?? [], [taskData]);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sortField, setSortField] = useState<SortField>("runningTime");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [groupByNode, setGroupByNode] = useState(true);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const toggleNodeCollapse = useCallback((nodeName: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeName)) next.delete(nodeName);
      else next.add(nodeName);
      return next;
    });
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      setSortDirection((prev) => (sortField === field && prev === "asc" ? "desc" : "asc"));
      setSortField(field);
    },
    [sortField],
  );

  const selectedTask = useMemo(
    () => tasks.find((t) => t.taskId === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  const cancellableCount = useMemo(() => tasks.filter((t) => t.cancellable).length, [tasks]);
  const longRunningCount = useMemo(
    () => tasks.filter((t) => t.runningTimeNanos >= LONG_RUNNING_THRESHOLD_NS).length,
    [tasks],
  );
  const oldestNanos = useMemo(
    () => tasks.reduce((max, t) => Math.max(max, t.runningTimeNanos), 0),
    [tasks],
  );

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

  const tasksByNode = useMemo(() => {
    if (!groupByNode) return null;
    const groups = new Map<string, TaskRow[]>();
    for (const task of filteredTasks) {
      const existing = groups.get(task.node);
      if (existing) existing.push(task);
      else groups.set(task.node, [task]);
    }
    return groups;
  }, [filteredTasks, groupByNode]);

  if (result.status === "error") {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{result.error}</Alert>
      </Box>
    );
  }

  const sortLabel = (field: SortField, label: string) => (
    <TableSortLabel
      active={sortField === field}
      direction={sortField === field ? sortDirection : "asc"}
      onClick={() => handleSort(field)}
    >
      {label}
    </TableSortLabel>
  );

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

      <KpiCards
        count={tasks.length}
        cancellable={cancellableCount}
        longRunning={longRunningCount}
        oldestNanos={oldestNanos}
      />

      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <TextField
          size="small"
          placeholder="Filter tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
          aria-label="Filter tasks"
        />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={groupByNode}
              onChange={(e) => setGroupByNode(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Group by node</Typography>}
          sx={{ ml: 1, userSelect: "none" }}
        />
      </Box>

      <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <TableContainer>
          <Table size="small" stickyHeader aria-label="Task list">
            <TableHead>
              <TableRow>
                <TableCell>Task ID</TableCell>
                <TableCell>{sortLabel("action", "Action")}</TableCell>
                <TableCell>{sortLabel("type", "Type")}</TableCell>
                <TableCell>{sortLabel("node", "Node")}</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>{sortLabel("startTime", "Start Time")}</TableCell>
                <TableCell>{sortLabel("runningTime", "Running Time")}</TableCell>
                <TableCell>{sortLabel("cancellable", "Cancellable")}</TableCell>
                <TableCell>Parent Task</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={TASK_TABLE_COLUMN_COUNT} sx={{ py: 0, border: 0 }}>
                    <LinearProgress />
                  </TableCell>
                </TableRow>
              )}
              {groupByNode
                ? Array.from(tasksByNode?.entries() ?? []).map(([nodeName, nodeTasks]) => {
                    const expanded = !collapsedNodes.has(nodeName);
                    return (
                      <Fragment key={nodeName}>
                        <NodeGroupHeader
                          nodeName={nodeName}
                          taskCount={nodeTasks.length}
                          expanded={expanded}
                          onToggle={() => toggleNodeCollapse(nodeName)}
                        />
                        {expanded &&
                          nodeTasks.map((t) => (
                            <TaskTableRow
                              key={t.taskId}
                              task={t}
                              selected={t.taskId === selectedTaskId}
                              onSelect={setSelectedTaskId}
                            />
                          ))}
                      </Fragment>
                    );
                  })
                : filteredTasks.map((t) => (
                    <TaskTableRow
                      key={t.taskId}
                      task={t}
                      selected={t.taskId === selectedTaskId}
                      onSelect={setSelectedTaskId}
                    />
                  ))}
              {!loading && filteredTasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={TASK_TABLE_COLUMN_COUNT} sx={{ border: 0 }}>
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

      <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTaskId(null)} />
    </Box>
  );
}
