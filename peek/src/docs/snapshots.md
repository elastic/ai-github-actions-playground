# Snapshots

Open Snapshots from the sidebar under System to browse snapshot repositories, view individual snapshots, and monitor Snapshot Lifecycle Management (SLM) policies.

## Tabs

The page is organized into three tabs:

### Snapshots

Lists all snapshots across all registered repositories:

- **State** — snapshot status (SUCCESS, PARTIAL, FAILED, IN_PROGRESS, INCOMPATIBLE).
- **Name** — the snapshot name.
- **Repository** — which repository holds the snapshot.
- **Index count** — number of indices included.
- **Start time** — when the snapshot began.
- **Duration** — how long the snapshot took to complete.

KPI cards summarize total snapshots, successful count, failed or partial count, and in-progress count.

### SLM Policies

Lists all Snapshot Lifecycle Management policies that automate snapshot creation and retention:

- **Name** — the policy name.
- **Repository** — the target repository.
- **Next run** — when the policy will next execute.
- **Taken** — total snapshots created by this policy.
- **Failed** — total snapshot failures for this policy.
- **Last success / Last failure** — timestamps of the most recent outcomes.

KPI cards summarize policy count, total snapshots taken, total failures, and retention runs.

### Repositories

Lists all registered snapshot repositories:

- **Name** — the repository name.
- **Type** — repository type (fs, s3, gcs, azure, url, etc.).

## Filtering and sorting

Use the search box to filter entries by name, repository, or type across all tabs. Click any column header to sort ascending or descending.

## Troubleshooting

If snapshots fail to load, verify that your credentials have the `monitor_snapshot` or `create_snapshot` cluster privilege.

If SLM policies show increasing failure counts:

1. Check the last failure details for the specific error.
2. Verify that the target repository is accessible and has sufficient storage.
3. Use the Console page to run `GET /_slm/policy/<policy_name>` for full policy configuration.
4. Check repository health with `GET /_snapshot/<repository_name>/_status`.
