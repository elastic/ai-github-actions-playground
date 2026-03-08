# Storage Explorer

Open Storage Explorer from the sidebar under System to visualize how storage is distributed across your Elasticsearch cluster.

## Treemap view

The Storage Explorer shows a treemap visualization of disk usage across indices. Each rectangle represents an index, sized proportionally to its store size. Colors indicate index health status:

- **Green** — healthy index with all shards allocated.
- **Yellow** — index with unassigned replica shards.
- **Red** — index with unassigned primary shards.

Hover over any rectangle to see the index name, store size, document count, and health status.

## Drill-down

Click any index in the treemap to navigate to its detail page in the Indices section, where you can inspect mappings, settings, stats, and disk usage at the field level.

## Filtering

Use the search box to highlight specific indices in the treemap. The visualization updates to emphasize matching indices while dimming others.

Toggle **Include system indices** to show or hide indices starting with a dot (`.`).

## Use cases

- **Identify storage hotspots** — quickly spot the largest indices consuming the most disk space.
- **Audit retention** — find old or oversized indices that may need lifecycle management.
- **Capacity planning** — understand storage distribution before adding nodes or changing shard allocation.

## Troubleshooting

If the treemap is empty, verify that your credentials have access to the `_cat/indices` API and that indices exist in the cluster.
