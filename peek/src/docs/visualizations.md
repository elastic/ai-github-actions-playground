# Visualization Types

Time Series — line charts for data with a date column. Supports smoothing, area fill, and stacking.

Bar Chart — vertical or horizontal bars. Supports stacking.

Pie Chart — proportional slices from a categorical breakdown.

Heatmap — color-density matrix for comparing values across two dimensions.

Scatter — point plot for correlation and distribution across numeric axes.

Histogram — bucketed distribution chart for showing value frequency.

Stat — a single large number, ideal for KPIs and counters.

Gauge — a value shown on a radial gauge with configurable min/max range.

Table — raw tabular output, useful for detailed inspection of query results.

Markdown — rich-text panel rendered from Markdown. Supports **parameterized tokens**: use `{{name}}` to insert the current value of a dashboard variable. For example, if you have a parameter called `service`, writing `Owner: {{service}}` will render the current value of that parameter. Unknown tokens are left as-is. This lets you build dynamic runbook notes, escalation links, and context panels that follow the current dashboard state.
