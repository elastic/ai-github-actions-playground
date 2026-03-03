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
  const spans =
    data && "columns" in data && "values" in data
      ? parseSpansFromEsql(
          data.columns as Array<{ name: string; type: string }>,
          data.values as unknown[][],
          { ...DEFAULT_FIELD_MAPPING, ...spec.fieldMapping },
        )
      : [];

  return <SpanTreeView spans={spans} options={spec} />;
}
