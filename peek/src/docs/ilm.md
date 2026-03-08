# Index Lifecycle Management

Open Index Lifecycle Management (ILM) from the sidebar under System to browse and inspect lifecycle policies that govern index retention, rollover, and deletion.

## Policy list

The page lists all ILM policies in the cluster with:

- **Policy name** — the unique identifier for the policy.
- **Phases** — the lifecycle phases defined (hot, warm, cold, frozen, delete).
- **Managed indices** — count of indices currently managed by the policy.

Use the search box to filter policies by name.

## Policy detail

Select a policy to view its full configuration:

- **Phase timeline** — a visual representation of the phases and their transitions.
- **Phase configuration** — detailed settings for each phase including rollover conditions, shrink settings, force merge, readonly, and delete timing.
- **Actions** — the specific actions configured for each phase (e.g., `rollover`, `shrink`, `forcemerge`, `delete`).

## Common ILM patterns

- **Hot-warm-cold** — new data lands in the hot phase on fast storage, rolls over to warm after a size or age threshold, then moves to cold for long-term retention before eventual deletion.
- **Hot-delete** — data rolls over and is deleted after a retention period, suitable for short-lived operational logs.
- **Hot-frozen-delete** — data moves to frozen tier (searchable snapshots) before deletion to balance cost and searchability.

## Troubleshooting

If an index appears stuck in a lifecycle phase:

1. Check the `_ilm/explain` API output for the index to see the current step and any error details.
2. Verify that the ILM policy referenced by the index still exists and has the expected phase configuration.
3. Use the Console page to run `POST /{index}/_ilm/retry` to retry a failed ILM step.

If ILM policies fail to load, verify that your credentials have the `manage_ilm` or `read_ilm` cluster privilege.
