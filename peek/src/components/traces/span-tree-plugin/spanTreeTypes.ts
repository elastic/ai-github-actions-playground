/**
 * Types for the span tree viewer plugin.
 */
import type { Span, SpanTreeNode } from "../traceUtils";
import type { TraceFieldMapping } from "../traceQueryBuilder";

/** Statistics for a collapsed group of consecutive sibling spans */
export interface GroupStats {
  count: number;
  totalDurationUs: number;
  minDurationUs: number;
  maxDurationUs: number;
  errorCount: number;
  serviceName: string;
  operationName: string;
}

/** A run of consecutive siblings that share the same service+operation key */
export interface GroupRun {
  key: string;
  parentId: string;
  startIndex: number;
  nodes: SpanTreeNode[];
  stats: GroupStats;
}

/** A single row in the flattened span tree */
export type SpanTreeRowItem =
  | {
      type: "span";
      node: SpanTreeNode;
      expanded: boolean;
      hasChildren: boolean;
    }
  | {
      type: "group";
      groupKey: string;
      parentId: string;
      spans: SpanTreeNode[];
      depth: number;
      expanded: boolean;
      stats: GroupStats;
    };

/** Options for the TracingSpanTree Perses panel plugin */
export interface TracingSpanTreeOptions {
  fieldMapping?: Partial<TraceFieldMapping>;
  visual?: {
    /** Show timeline duration bars (default: true) */
    showTimeline?: boolean;
    /** Show timestamp column (default: true in search mode, false in detail) */
    showTimestamp?: boolean;
    /** Minimum consecutive siblings to auto-collapse (default: 3) */
    autoCollapseThreshold?: number;
    /** Auto-expand tree to this depth (default: 2) */
    defaultExpandDepth?: number;
  };
}

/** Props for the standalone SpanTreeView component */
export interface SpanTreeViewProps {
  spans: Span[];
  options?: TracingSpanTreeOptions;
  showToolbar?: boolean;
  selectedTraceId?: string | null;
  selectedSpanId?: string | null;
  onSelectTrace?: (traceId: string, spanId?: string, timestamp?: string) => void;
  onSelectSpan?: (spanId: string) => void;
  onBack?: () => void;
  onOpenInQueryLab?: () => void;
  maxDuration?: number;
  loading?: boolean;
}
