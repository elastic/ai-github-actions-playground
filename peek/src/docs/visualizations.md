# Visualization Types

Peek supports a variety of chart types for dashboard panels. Each panel has its own ES|QL query and chart type — choose the one that best fits your data shape.

## Time Series

Line charts for data with a date column. Best for showing trends, latency percentiles, and throughput over time.

- **Smoothing** — reduce noise in volatile data by enabling line smoothing.
- **Area fill** — fill the area under the line to emphasize volume.
- **Stacking** — stack multiple series to show cumulative totals.

## Bar Chart

Vertical or horizontal bars for comparing categorical values. Use stacking to show composition within each category.

## Pie Chart

Proportional slices from a categorical breakdown. Best for showing distribution of a single dimension (e.g., error types, service languages).

## Heatmap

Color-density matrix for comparing values across two dimensions. Useful for time-of-day analysis, correlation matrices, and resource utilization patterns.

## Scatter

Point plot for correlation and distribution analysis across two numeric axes. Click a point to inspect the underlying data.

## Histogram

Bucketed distribution chart showing value frequency. Use for latency distributions, request size analysis, and statistical profiling.

## Stat

A single large number, ideal for KPIs, counters, and at-a-glance metrics. Pair with a `STATS` aggregation in your ES|QL query.

## Gauge

A value shown on a radial gauge with configurable min/max range. Use for utilization percentages, SLA scores, and capacity indicators.

## Table

Raw tabular output for detailed inspection of query results. Table panels include an **Export CSV** button in the panel controls that downloads the currently loaded rows as a `.csv` file named `{panel-title}-{timestamp}.csv`.

## Markdown

Rich text panels for adding context, notes, and instructions to dashboards. Supports full Markdown syntax including headings, lists, links, and code blocks.

Use **parameterized tokens** with `{{name}}` to insert the current value of a dashboard variable. For example, if you have a parameter called `service`, writing `Owner: {{service}}` renders the current value. Unknown tokens are left as-is. This lets you build dynamic runbook notes, escalation links, and context panels that follow the current dashboard state.

Use **embedded ES|QL queries** with `${query}` syntax to display live query results inline:

- **Single value** (1 row, 1 column): rendered inline as text — `the top customer is ${FROM sales-* | SORT revenue DESC | KEEP name | LIMIT 1}`
- **List** (N rows, 1 column): rendered as a bulleted list — `${FROM sales-* | SORT revenue DESC | KEEP name | LIMIT 3}`
- **Table** (N rows, multiple columns): rendered as a markdown table — `${FROM sales-* | SORT revenue DESC | KEEP name, dob, revenue | LIMIT 5}`

Embedded queries respect the dashboard time range and parameter values (using `?param` syntax inside the ES|QL). If a query fails or the cluster is not connected, the raw `${...}` token is left in place.

## Choosing the right type

| Data shape                 | Recommended type |
| -------------------------- | ---------------- |
| Time-series trend          | Time Series      |
| Category comparison        | Bar Chart        |
| Distribution breakdown     | Pie Chart        |
| Two-dimensional density    | Heatmap          |
| Correlation of two metrics | Scatter          |
| Value frequency            | Histogram        |
| Single KPI value           | Stat or Gauge    |
| Detailed rows              | Table            |
| Annotations and notes      | Markdown         |
