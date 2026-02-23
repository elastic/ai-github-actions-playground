# Metrics

Open Metrics from the sidebar to explore time-series metrics without writing ES|QL by hand.

## Namespace overview

Pick a namespace from the dropdown to see a wall of sparkline charts — one for every metric in that namespace.
Only metrics that have data points in the selected time range are shown.
Click any chart card to drill into that metric's detail view.

## Metric detail

After selecting a metric (from the overview grid or the search bar), you enter detail mode:

Choose an aggregation (including percentiles p50, p95, and p99), then add dimension filters or split by a dimension.
The dimension sidebar is scoped to fields relevant to the selected metric's namespace.

Use the time picker and refresh interval in the app header to tune the query window for fast troubleshooting versus long-range trend analysis.

Use View ES|QL to inspect the generated query and validate what the UI is producing.

When the result looks right, use Edit in Query Lab for manual refinement or Save to Dashboard to create a panel.

Use the **Back to overview** button above the chart to return to the namespace grid.

If charts are empty, verify the selected namespace and field exist in the chosen time range and remove restrictive dimension filters.
