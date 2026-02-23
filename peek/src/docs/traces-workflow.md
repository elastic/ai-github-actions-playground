# Traces

Open Traces from the sidebar to search and explore distributed traces stored in Elasticsearch using OpenTelemetry data.

Use the service name field and Add Service button to filter results to one or more services. Added services appear as removable filter chips above the query editor.

Set a minimum or maximum duration (in milliseconds) and click Apply to narrow results to traces within a specific latency range. Duration filters also appear as removable chips.

Click the Error or OK status chips to filter results by span status code.

Use Reset Filters to clear all active filters and return to the default query.

The ES|QL query editor shows the generated query and can be edited directly. Manual edits override the filter-driven query until filters are changed again.

Click Search Traces to run the current query against your Elasticsearch cluster.

Switch between List, Scatter, Timeseries, and Service Map view modes using the chips above the results panel. List shows a table of matching traces. Scatter plots trace duration over time, colored by service, and supports clicking a point to open the trace detail. Timeseries view requires an aggregation query. Service Map renders service-to-service relationships for the selected trace.

Click any row in the List view or any point in the Scatter view to load the trace detail panel below. The detail panel shows a waterfall chart of spans for the selected trace. Service Map is populated from this selected trace; if no trace is selected, it prompts you to select one from List or Scatter first.

Click a span in the waterfall to open the Span Detail drawer. Use Filter By or Exclude in the drawer to add tag-based filters and re-run the search automatically.

If results are empty, verify that your Elasticsearch index contains OpenTelemetry-compatible span data and that the selected time range and service filters match existing data.
