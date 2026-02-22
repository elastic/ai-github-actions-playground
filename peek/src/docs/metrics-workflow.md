# Metrics

Open Metrics from the sidebar to explore time-series metrics without writing ES|QL by hand.

Pick a namespace first, then search and select a metric field.

Choose an aggregation (including percentiles p50, p95, and p99), then add dimension filters or split by a dimension.

Use the time picker and refresh interval in the app header to tune the query window for fast troubleshooting versus long-range trend analysis.

Use View ES|QL to inspect the generated query and validate what the UI is producing.

When the result looks right, use Edit in Query Lab for manual refinement or Save to Dashboard to create a panel.

If charts are empty, verify the selected namespace and field exist in the chosen time range and remove restrictive dimension filters.
