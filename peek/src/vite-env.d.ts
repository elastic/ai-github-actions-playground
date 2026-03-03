/// <reference types="vite/client" />

declare module "@perses-dev/tracing-gantt-chart-plugin/lib/TracingGanttChart/TracingGanttChart" {
  import type { ReactElement } from "react";
  import type { otlptracev1 } from "@perses-dev/core";

  export interface TracingGanttChartOptions {
    visual?: { palette?: { mode: "auto" | "categorical" } };
    links?: {
      trace?: string;
      span?: string;
      attributes?: Array<{ name: string; link: string }>;
    };
    selectedSpanId?: string;
  }

  export interface CustomLinks {
    variables: Record<string, string>;
    links: {
      trace?: string;
      span?: string;
      attributes?: Array<{ name: string; link: string }>;
    };
  }

  export interface TracingGanttChartProps {
    options: TracingGanttChartOptions;
    customLinks?: CustomLinks;
    trace: otlptracev1.TracesData;
  }

  export function TracingGanttChart(props: TracingGanttChartProps): ReactElement;
}
