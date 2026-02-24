# Visualization Types

Time Series — line charts for data with a date column. Supports smoothing, area fill, and stacking.

Bar Chart — vertical or horizontal bars. Supports stacking.

Pie Chart — proportional slices from a categorical breakdown.

Heatmap — color-density matrix for comparing values across two dimensions.

Scatter — point plot for correlation and distribution across numeric axes.

Histogram — bucketed distribution chart for showing value frequency.

Stat — a single large number, ideal for KPIs and counters.

Gauge — a value shown on a radial gauge with configurable min/max range.

Table — raw tabular output, useful for detailed inspection of query results. Table panels include an **Export CSV** button in the panel controls that downloads the currently loaded rows as a `.csv` file named `{panel-title}-{timestamp}.csv`. The export covers only the rows returned by the panel's last query execution.

Markdown — rich-text panel rendered from Markdown. Supports **parameterized tokens**: use `{{name}}` to insert the current value of a dashboard variable. For example, if you have a parameter called `service`, writing `Owner: {{service}}` will render the current value of that parameter. Unknown tokens are left as-is. This lets you build dynamic runbook notes, escalation links, and context panels that follow the current dashboard state.

Markdown panels also support **embedded ES|QL queries** using `${query}` syntax. The query runs against the connected Elasticsearch cluster and the result is rendered inline:

- **Single value** (1 row, 1 column): rendered inline as text — `the top customer is ${FROM sales-* | SORT revenue DESC | KEEP name | LIMIT 1}`
- **List** (N rows, 1 column): rendered as a bulleted list — `${FROM sales-* | SORT revenue DESC | KEEP name | LIMIT 3}`
- **Table** (N rows, multiple columns): rendered as a markdown table — `${FROM sales-* | SORT revenue DESC | KEEP name, dob, revenue | LIMIT 5}`

Embedded queries respect the dashboard time range and parameter values (using `?param` syntax inside the ES|QL). If a query fails or the cluster is not connected, the raw `${...}` token is left in place.
