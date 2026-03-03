/**
 * Perses PanelComponent wrapper for TracingSpanTree.
 * Extracts options and query data from PanelProps and renders SpanTreeView.
 */
import type { PanelProps } from "@perses-dev/plugin-system";

import { parseSpansFromEsql } from "../traceUtils";
import { DEFAULT_FIELD_MAPPING } from "../traceQueryBuilder";

import SpanTreeView from "./SpanTreeView";
import type { TracingSpanTreeOptions } from "./spanTreeTypes";

export default function TracingSpanTreePanel(props: PanelProps<TracingSpanTreeOptions>) {
  const { spec, queryResults } = props;

  const data = queryResults?.[0]?.data;
  const hasTabularData =
    !!data &&
    typeof data === "object" &&
    Array.isArray((data as { columns?: unknown }).columns) &&
    Array.isArray((data as { values?: unknown }).values);
  const spans = hasTabularData
    ? parseSpansFromEsql(
        (data as { columns: Array<{ name: string; type: string }> }).columns,
        (data as { values: unknown[][] }).values,
        { ...DEFAULT_FIELD_MAPPING, ...spec.fieldMapping },
      )
    : [];

  return <SpanTreeView spans={spans} options={spec} />;
}
