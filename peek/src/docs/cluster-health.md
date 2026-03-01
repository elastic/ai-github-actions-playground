# Cluster Health

Open Cluster Health from the sidebar for a consolidated, refreshable view of cluster operational health across six tabs.

Use the built-in refresh picker to reload all tabs on demand or set an auto-refresh interval. The last-updated timestamp shows when data was most recently fetched.

## Tabs

**Overview** — High-level cluster status summary combining health state, pending tasks, and allocation information.

**Nodes** — Detailed node inventory table showing per-node CPU, heap, disk, and shard/doc load.

**Tasks** — Task backlog view listing pending and in-flight cluster tasks.

**Capacity** — Capacity pressure metrics highlighting disk, memory, and shard-level resource pressure across nodes.

**Shards** — Shard distribution view showing shard placement, sizes, and balance across the cluster.

**Resilience** — Resilience signals including ILM/SLM policy status, snapshot health, recovery progress, and allocation explanations.

## When to use Cluster Health vs Cluster Overview

Cluster Overview provides a quick identity and health snapshot — cluster name, version, shard counts, and object totals — useful for confirming cluster state at a glance.

Cluster Health goes deeper with six dedicated tabs, built-in auto-refresh, and operational detail (task backlogs, capacity pressure, shard distribution, resilience signals). Use it for active monitoring, troubleshooting, and capacity planning.

## Companion routes

The Tasks, Capacity, Shards, and Resilience tabs are also available as standalone pages. These companion routes are not shown in the sidebar but can be accessed through the Cluster Health tabs or by direct URL.
