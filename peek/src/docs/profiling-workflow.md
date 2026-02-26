# Profiling

Open Profiling from the sidebar to explore continuous profiling data stored in Elasticsearch using Universal Profiling.

Use the Executable, Thread, Service, and Host fields to narrow results to a specific process, thread name, service, or host. Filters are applied to every view mode automatically.

Set the Time range dropdown to control the window of profiling data to query. The default range is the last hour.

## View modes

Switch between **Top Functions**, **Stacktraces**, **Timeline**, and **Flamegraph** using the chips at the top of the filters panel.

**Top Functions** calls the Universal Profiling top-functions API and returns a ranked table of function names, their self counts, and total counts. The query preview panel shows the JSON request body sent to the API. This view is read-only; the query body cannot be edited manually.

**Stacktraces** queries the `profiling-events-all` index to retrieve raw stacktrace IDs, then resolves each stacktrace against `profiling-stacktraces` and symbolizes the resulting frames using `profiling-stackframes`. Results are displayed as a table of stacktrace IDs with their sample count, service name, and host. Click any row to expand it and see the symbolized frame list.

**Timeline** queries `profiling-events-all` and aggregates `Stacktrace.count` into time buckets so you can see profiling activity over time as a line chart.

**Flamegraph** displays the same stacktrace data as a hierarchical flame graph visualization. Click any frame to zoom into that subtree and explore deeper call paths. A breadcrumb trail appears above the chart showing the current zoom path — click any segment to jump back. Use the search box to find and highlight specific function names; matching frames are highlighted while others are dimmed. When zoomed into a frame, click **Open in Query Lab** to pivot to Query Lab with a filtered ES|QL query for that function.

## Query editor

The ES|QL query preview shows the generated query for the Stacktraces and Timeline views. You can edit the query directly; manual edits override the filter-driven query until filters change. The Top Functions view shows the JSON request body, which is always generated from the current filters and cannot be edited.

Click **Run** to execute the current view against your Elasticsearch cluster.

Click **Reset Filters** to clear all active filters and return to the default query.

Click **Open in Query Lab** (available for Stacktraces and Timeline views) to pivot to Query Lab with the current ES|QL query pre-populated as a draft.

## Data sources

The Profiling page expects Universal Profiling data in the standard Elastic indices:

- `profiling-events-all` — raw stacktrace sample events
- `profiling-stacktraces` — stacktrace frame ID lists, keyed by stacktrace ID
- `profiling-stackframes` — symbolized frame metadata (function name, file name, line number)

If results are empty, verify that your Elasticsearch cluster has Universal Profiling enabled and that data exists in the selected time range for the chosen filters.
