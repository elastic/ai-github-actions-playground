/**
 * Span and trace data types and tree-building utilities.
 */

/** Represents a single span in a trace */
export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  serviceName: string;
  name: string;
  kind: string;
  durationUs: number;
  status: string;
  timestamp: string;
  startTimeUs: number;
  attributes: Record<string, unknown>;
}

/** A span augmented with tree information for rendering */
export interface SpanTreeNode {
  span: Span;
  children: SpanTreeNode[];
  depth: number;
}

/**
 * Build a span tree from a flat list of spans.
 * Returns root nodes (spans with no parent or whose parent is not in the list).
 * Handles orphan spans by attaching them as roots.
 * Detects and breaks cycles by tracking visited spans.
 */
export function buildSpanTree(spans: Span[]): SpanTreeNode[] {
  const byId = new Map<string, SpanTreeNode>();
  for (const span of spans) {
    byId.set(span.spanId, { span, children: [], depth: 0 });
  }

  const roots: SpanTreeNode[] = [];

  for (const node of byId.values()) {
    const parentId = node.span.parentSpanId;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // If every span points to a parent present in this trace (pure cycle),
  // seed a deterministic synthetic root so rendering doesn't collapse to empty.
  if (roots.length === 0 && byId.size > 0) {
    let earliestNode: SpanTreeNode | null = null;
    for (const node of byId.values()) {
      if (!earliestNode || node.span.startTimeUs < earliestNode.span.startTimeUs) {
        earliestNode = node;
      }
    }
    if (earliestNode) {
      roots.push(earliestNode);
    }
  }

  // Sort children by timestamp (chronological order)
  const sortedVisited = new Set<string>();
  function sortChildren(node: SpanTreeNode): void {
    if (sortedVisited.has(node.span.spanId)) return;
    sortedVisited.add(node.span.spanId);
    node.children.sort((a, b) => a.span.startTimeUs - b.span.startTimeUs);
    for (const child of node.children) {
      sortChildren(child);
    }
  }

  // Sort roots by timestamp
  roots.sort((a, b) => a.span.startTimeUs - b.span.startTimeUs);

  for (const root of roots) {
    sortChildren(root);
  }

  // Assign depths via DFS, breaking cycles
  const visited = new Set<string>();
  function assignDepths(node: SpanTreeNode, depth: number): void {
    if (visited.has(node.span.spanId)) return;
    visited.add(node.span.spanId);
    node.depth = depth;
    for (const child of node.children) {
      assignDepths(child, depth + 1);
    }
  }

  for (const root of roots) {
    assignDepths(root, 0);
  }

  return roots;
}

/**
 * Flatten a span tree via DFS for waterfall rendering.
 * Returns spans in visual order (parent above children, siblings in chronological order).
 */
export function flattenSpanTree(roots: SpanTreeNode[]): SpanTreeNode[] {
  const result: SpanTreeNode[] = [];
  const visited = new Set<string>();
  function dfs(node: SpanTreeNode): void {
    if (visited.has(node.span.spanId)) return;
    visited.add(node.span.spanId);
    result.push(node);
    for (const child of node.children) {
      dfs(child);
    }
  }
  for (const root of roots) {
    dfs(root);
  }
  return result;
}

/**
 * Parse raw ES|QL response rows into Span objects.
 * Maps column names to span fields using a flexible lookup.
 */
export function parseSpansFromEsql(
  columns: Array<{ name: string; type: string }>,
  values: unknown[][],
  fieldMapping: {
    traceId: string;
    spanId: string;
    parentSpanId: string;
    serviceName: string;
    spanName: string;
    spanKind: string;
    durationUs: string;
    durationNs: string;
    statusCode: string;
    timestamp: string;
    timestampUs: string;
  },
): Span[] {
  const colIndex = new Map<string, number>();
  for (let i = 0; i < columns.length; i++) {
    colIndex.set(columns[i]!.name, i);
  }

  const get = (row: unknown[], field: string): unknown => {
    const idx = colIndex.get(field);
    return idx !== undefined ? row[idx] : null;
  };

  // Gather all known field names to exclude from attributes
  const knownFields = new Set(Object.values(fieldMapping));

  return values.map((row) => {
    const attributes: Record<string, unknown> = {};
    for (const [colName, idx] of colIndex) {
      if (!knownFields.has(colName) && row[idx] != null) {
        attributes[colName] = row[idx];
      }
    }

    const parsedTimestampUs = Number(get(row, fieldMapping.timestampUs) ?? NaN);
    const parsedDurationUs = Number(get(row, fieldMapping.durationUs) ?? NaN);
    const parsedDurationNs = Number(get(row, fieldMapping.durationNs) ?? NaN);
    const fallbackStartTimeUs =
      new Date(String(get(row, fieldMapping.timestamp) ?? "")).getTime() * 1000;
    const startTimeUs =
      Number.isFinite(parsedTimestampUs) && parsedTimestampUs > 0
        ? parsedTimestampUs
        : fallbackStartTimeUs;
    const durationUs =
      Number.isFinite(parsedDurationUs) && parsedDurationUs > 0
        ? parsedDurationUs
        : Number.isFinite(parsedDurationNs) && parsedDurationNs > 0
          ? parsedDurationNs / 1000
          : 0;

    const rawParentSpanId = get(row, fieldMapping.parentSpanId);

    return {
      traceId: String(get(row, fieldMapping.traceId) ?? ""),
      spanId: String(get(row, fieldMapping.spanId) ?? ""),
      parentSpanId: rawParentSpanId ? String(rawParentSpanId) : null,
      serviceName: String(get(row, fieldMapping.serviceName) ?? "unknown"),
      name: String(get(row, fieldMapping.spanName) ?? ""),
      kind: String(get(row, fieldMapping.spanKind) ?? ""),
      durationUs,
      status: String(get(row, fieldMapping.statusCode) ?? "OK"),
      timestamp: String(get(row, fieldMapping.timestamp) ?? ""),
      startTimeUs,
      attributes,
    };
  });
}

/** Format a duration in microseconds to a human-readable string */
export function formatSpanDuration(durationUs: number): string {
  if (durationUs >= 1_000_000) {
    return `${(durationUs / 1_000_000).toFixed(durationUs >= 10_000_000 ? 0 : 1)}s`;
  }
  if (durationUs >= 1_000) {
    return `${(durationUs / 1_000).toFixed(durationUs >= 10_000 ? 0 : 1)}ms`;
  }
  return `${durationUs}µs`;
}

/**
 * Calculate trace-level timing info from a list of spans.
 */
export function getTraceTimeBounds(spans: Span[]): { startUs: number; endUs: number } {
  if (spans.length === 0) return { startUs: 0, endUs: 0 };
  let minStart = Infinity;
  let maxEnd = -Infinity;
  for (const span of spans) {
    const startUs = span.startTimeUs;
    const endUs = startUs + span.durationUs;
    if (startUs < minStart) minStart = startUs;
    if (endUs > maxEnd) maxEnd = endUs;
  }
  return { startUs: minStart, endUs: maxEnd };
}
