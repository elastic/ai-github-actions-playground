# Tasks

Open Tasks from the sidebar under System to view pending and in-flight cluster tasks.

## Task list

The page shows all pending cluster tasks with:

- **Priority** — task priority level (URGENT, HIGH, NORMAL).
- **Source** — the operation or component that submitted the task.
- **Time in queue** — how long the task has been waiting.
- **Insert order** — the order in which the task was submitted.

Tasks are sorted by insert order, with the oldest tasks at the top.

## When to use Tasks

Monitor the task queue when:

- **Cluster state changes are slow** — a backlog of pending tasks can indicate master node pressure.
- **Index creation or deletion is delayed** — these operations queue as cluster tasks.
- **Shard allocation is stalled** — allocation decisions appear as pending tasks.
- **After a node restart** — watch for recovery-related tasks to complete.

## Relationship to Cluster Health

Tasks is also available as a tab within the Cluster Health page. The standalone Tasks page and the Cluster Health → Tasks tab show the same data. Use whichever access path fits your workflow.

## Troubleshooting

If the task queue is growing:

1. Check the master node's CPU and heap usage in the Nodes page.
2. Look for repeated task types that indicate a stuck operation.
3. Use the Console page to run `GET /_cluster/pending_tasks` for the raw task list.
4. Consider whether bulk operations or rapid index creation are flooding the queue.
