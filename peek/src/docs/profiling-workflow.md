# Profiling

Open Profiling from the sidebar to explore continuous profiling data stored in Elasticsearch using Universal Profiling.

The guided flow walks you through three steps to get to the right flamegraph quickly:

1. **Choose a focus** — Pick what you are investigating: Service, Host, Process, Thread, or Everything.
2. **Pick a value** — A live list shows the top candidates ranked by sample count in the selected time window. Use the search box to filter by name.
3. **View results** — The flamegraph (or any other view mode) loads automatically for the selected focus.

Use the **breadcrumb** at the top to understand the current focus context. Click **Change focus** to restart the picker and explore a different service or host.

## View modes

Switch between **Flamegraph**, **Top Functions**, **Timeline**, **Flamescope**, and **Stacktraces** using the chips in the results toolbar.

**Flamegraph** displays stacktrace data as a hierarchical flame graph visualization. Click any frame to zoom into that subtree and explore deeper call paths. A breadcrumb trail appears above the chart showing the current zoom path — click any segment to jump back. Use the search box to find and highlight specific function names. Click **Open in Query Lab** to pivot to Query Lab with a filtered ES|QL query for that function.

**Top Functions** calls the Universal Profiling top-functions API and returns a ranked table of function names, their self counts, and total counts.

**Timeline** queries `profiling-events-all` and aggregates `Stacktrace.count` into time buckets so you can see profiling activity over time as a line chart.

**Flamescope** visualizes stacktrace density over time as a heatmap (time buckets on X, top stacktrace signatures on Y) with a synchronized flamegraph for the selected bucket. Click any heatmap cell to change the selected time window. **Open in Query Lab** preserves the selected Flamescope window so you can continue investigation with a time-scoped query.

**Stacktraces** queries the `profiling-events-all` index to retrieve raw stacktrace IDs, then resolves each stacktrace against `profiling-stacktraces` and symbolizes the resulting frames using `profiling-stackframes`. Results are displayed as a table of stacktrace IDs with their sample count, service name, and host. Click any row to expand it and see the symbolized frame list.

### Open in Query Lab

**Open in Query Lab** is available for Stacktraces, Timeline, Flamegraph, and Flamescope. It opens Query Lab with the current ES|QL query pre-populated as a draft so you can continue analysis.

## Advanced view

Click **Advanced view** in the results toolbar to open `/profiling/advanced`. The advanced page exposes all four filter fields (Executable, Thread, Service, Host), the time range picker, and a raw ES|QL editor. Use it when you need to combine multiple filters simultaneously, manually edit the generated query, or run ad-hoc profiling queries beyond what the guided flow supports.

The advanced page has a **← Guided flow** button to return to the picker at any time.

## Time range

Use the Time range dropdown in the results toolbar to control the window of profiling data to query. The default range is the last hour. Changing the time range automatically re-runs the current view.

## Query editor

The ES|QL query preview in the advanced page shows the generated query for the Stacktraces and Timeline views. You can edit the query directly; manual edits override the filter-driven query until filters change. The Top Functions view shows the JSON request body, which is always generated from the current filters and cannot be edited.

## Data sources

The Profiling page expects Universal Profiling data in the standard Elastic indices:

- `profiling-events-all` — raw stacktrace sample events
- `profiling-stacktraces` — stacktrace frame ID lists, keyed by stacktrace ID
- `profiling-stackframes` — symbolized frame metadata (function name, file name, line number)

If results are empty, verify that your Elasticsearch cluster has Universal Profiling enabled and that data exists in the selected time range for the chosen filters.
