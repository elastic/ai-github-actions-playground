# Nodes

Open Nodes from the sidebar under System to inspect individual Elasticsearch nodes in your cluster.

## Node list

The page shows all nodes with key operational metrics:

- **Name** — the node name and transport address.
- **Roles** — assigned node roles (master, data, ingest, ml, etc.).
- **CPU** — current CPU utilization percentage.
- **Heap** — JVM heap usage as a percentage of the maximum.
- **Disk** — disk usage and available space.
- **Shards** — number of shards hosted on the node.
- **Documents** — total document count across all shards on the node.

Use the search box to filter nodes by name or role.

## Node detail

Click any node row to open the detail view with in-depth operational data:

- **Overview** — node identity (name, ID, transport address, version, roles) and current resource utilization.
- **JVM** — heap usage breakdown, garbage collection stats, and thread pools.
- **OS** — operating system metrics including CPU load averages, memory usage, and swap.
- **File system** — disk I/O stats and available space per data path.
- **Transport** — network transport statistics (connections, bytes sent/received).
- **HTTP** — HTTP connection counts and request statistics.

## Troubleshooting

If a node shows high resource utilization:

1. Check the **JVM** section for excessive garbage collection pauses.
2. Review the **Shards** count — an unbalanced shard distribution can overload individual nodes.
3. Use Cluster Health → Capacity tab for a cluster-wide capacity pressure view.

If nodes fail to load, verify that your credentials have access to the `_nodes` and `_nodes/stats` APIs.
