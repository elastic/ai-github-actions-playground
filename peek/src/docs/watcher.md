# Watchers

Open Watchers from the sidebar under System to browse and inspect Elasticsearch Watcher alerts and watches.

## Watch list

The page lists all watches defined in the cluster:

- **Watch ID** — the unique identifier for the watch.
- **Status** — whether the watch is active or inactive.
- **Last triggered** — timestamp of the most recent execution.

Use the search box to filter watches by ID.

## Watch detail

Select a watch to view its full configuration:

- **Trigger** — the schedule or condition that initiates the watch (e.g., every 5 minutes, cron expression).
- **Input** — the data source query that the watch evaluates (typically an Elasticsearch query).
- **Condition** — the logic that determines whether to execute actions (e.g., result count exceeds threshold).
- **Actions** — what happens when the condition is met (e.g., send email, post to webhook, write to index).

## Common use cases

- **Log threshold alerts** — trigger when error log count exceeds a threshold in a time window.
- **Health monitoring** — watch cluster health status and alert on yellow or red state changes.
- **Index size alerts** — monitor index sizes and alert when approaching disk capacity.

## Troubleshooting

If a watch is not triggering as expected:

1. Check the watch status — it may be throttled or inactive.
2. Verify the trigger schedule is correct.
3. Test the input query independently in the Console to confirm it returns expected data.
4. Check the condition logic against the actual query results.

If watches fail to load, verify that your credentials have the `manage_watcher` or `monitor_watcher` cluster privilege and that Watcher is enabled on the cluster.
