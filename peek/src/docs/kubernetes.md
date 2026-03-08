# Kubernetes

Open Kubernetes from the sidebar under Data to explore Kubernetes cluster telemetry collected by Elastic Agent or OpenTelemetry.

## Cluster overview

The Kubernetes landing page shows a high-level summary of cluster health including node count, pod count, namespace count, and workload count. Use it as a starting point to drill into specific resources.

## Navigation hierarchy

Kubernetes pages follow a drill-down hierarchy:

1. **Cluster** — top-level health and resource counts.
2. **Namespace** — resource usage and pod counts within a namespace.
3. **Workload** — deployment, statefulset, or daemonset detail with replica status.
4. **Pod** — individual pod status, resource requests/limits, container health, and logs.

Click any row in a parent table to drill into the child view. Breadcrumbs at the top show your current position in the hierarchy and allow quick navigation back to parent levels.

## Metrics and charts

Each level displays relevant time-series metrics:

- **Cluster** — CPU and memory utilization across all nodes, pod phase distribution, and pod restart counts.
- **Namespace** — aggregated CPU and memory usage, pod counts by phase, and top workloads by resource consumption.
- **Workload** — replica status (desired vs available vs unavailable), pod restart trends, and resource requests vs actual usage.
- **Pod** — container-level CPU and memory usage, restart history, and network I/O.

## Filtering and search

Use the search bar to filter resources by name at any level. The time picker in the app header controls the time range for all metrics and charts.

## Troubleshooting

If Kubernetes pages show no data:

1. Verify that `metrics-kubernetes.*` data streams exist in your cluster.
2. Check that the time range covers periods with active Kubernetes telemetry.
3. Confirm your credentials have read access to the Kubernetes metric indices.

For detailed field inspection, click **Open in Query Lab** to explore Kubernetes data with full ES|QL control.
