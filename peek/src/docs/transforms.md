# Transforms

Open Transforms from the sidebar under System to view and monitor Elasticsearch transform jobs that pivot or summarize your data into entity-centric indices.

## KPI cards

The top of the page shows summary metrics at a glance:

- **Total** — the total number of transforms in the cluster.
- **Running** — transforms currently in the started or indexing state.
- **Failed** — transforms that encountered an error.
- **Stopped** — transforms that are not currently running.
- **Health issues** — transforms reporting a non-green health status.

## Transform list

The table lists all transforms with the following columns:

- **Health** — color-coded health indicator (green, yellow, red).
- **State** — current lifecycle state (started, indexing, stopped, failed, aborting, stopping).
- **ID** — the unique transform identifier.
- **Type** — whether the transform is continuous or batch.
- **Docs processed** — total documents read from the source index.
- **Docs indexed** — total documents written to the destination index.
- **Failures** — count of search and index failures.
- **Checkpoint** — the last completed checkpoint number.

Click any column header to sort ascending or descending.

## Filtering

- Use the search box to filter transforms by ID.
- Use the state dropdown to show only transforms in a specific state (started, indexing, stopped, failed, aborting, stopping).
- Toggle **Show only unhealthy** to display only transforms with a non-green health status.

## Transform detail

Select a transform row to open a detail drawer showing the full configuration including source indices, destination index, frequency, sync settings, retention policy, and runtime statistics.

## Troubleshooting

If transforms fail to load, verify that your credentials have the `monitor_transform` or `manage_transform` cluster privilege.

If a transform is stuck in the failed state:

1. Open the detail drawer to inspect the failure reason.
2. Check the source index for mapping conflicts or missing fields.
3. Use the Console page to run `GET /_transform/<transform_id>/_stats` for detailed error information.
4. Consider stopping and restarting the transform after fixing the underlying issue.
