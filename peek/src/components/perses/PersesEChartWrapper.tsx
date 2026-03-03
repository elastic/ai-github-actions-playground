/**
 * Extends the Perses EChart component with additional ECharts chart types
 * not registered by the upstream `@perses-dev/components` bundle.
 *
 * Perses registers Bar, Line, Gauge, Pie, Scatter, Custom, and Heatmap.
 * We add GraphChart for the service-map / drift-radar graph visualizations.
 */
import { use as echartsUse } from "echarts/core";
import { GraphChart } from "echarts/charts";

echartsUse([GraphChart]);

export { EChart } from "@perses-dev/components";
