/**
 * Span and trace data types and tree-building utilities.
 */

/** Represents a link from a span to another span/trace */
export interface SpanLink {
  traceId: string;
  spanId: string;
  attributes: Record<string, unknown>;
}

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
  links?: SpanLink[];
}

/** A span augmented with tree information for rendering */
export interface SpanTreeNode {
  span: Span;
  children: SpanTreeNode[];
  depth: number;
}

export interface ServiceMapNode {
  serviceName: string;
  spanCount: number;
  errorCount: number;
}

export interface ServiceMapEdge {
  source: string;
  target: string;
  callCount: number;
  errorCount: number;
  totalDurationUs: number;
}

export interface ServiceMapData {
  nodes: ServiceMapNode[];
  edges: ServiceMapEdge[];
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

function isErrorStatus(status: string): boolean {
  return status === "Error" || status === "STATUS_CODE_ERROR";
}

/**
 * Build an aggregated service dependency graph from span parent/child links.
 */
export function buildServiceMapData(spans: Span[]): ServiceMapData {
  const spanById = new Map<string, Span>();
  const nodeStats = new Map<string, ServiceMapNode>();
  const edgeStats = new Map<string, ServiceMapEdge>();

  for (const span of spans) {
    spanById.set(span.spanId, span);
    const existingNode = nodeStats.get(span.serviceName);
    if (existingNode) {
      existingNode.spanCount += 1;
      existingNode.errorCount += isErrorStatus(span.status) ? 1 : 0;
    } else {
      nodeStats.set(span.serviceName, {
        serviceName: span.serviceName,
        spanCount: 1,
        errorCount: isErrorStatus(span.status) ? 1 : 0,
      });
    }
  }

  for (const span of spans) {
    if (!span.parentSpanId) continue;
    const parentSpan = spanById.get(span.parentSpanId);
    if (!parentSpan || parentSpan.serviceName === span.serviceName) continue;

    const key = `${parentSpan.serviceName}→${span.serviceName}`;
    const existingEdge = edgeStats.get(key);
    if (existingEdge) {
      existingEdge.callCount += 1;
      existingEdge.errorCount += isErrorStatus(span.status) ? 1 : 0;
      existingEdge.totalDurationUs += span.durationUs;
    } else {
      edgeStats.set(key, {
        source: parentSpan.serviceName,
        target: span.serviceName,
        callCount: 1,
        errorCount: isErrorStatus(span.status) ? 1 : 0,
        totalDurationUs: span.durationUs,
      });
    }
  }

  return {
    nodes: Array.from(nodeStats.values()),
    edges: Array.from(edgeStats.values()),
  };
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
      if (!knownFields.has(colName) && row[idx] != null && !isSpanLinkColumn(colName)) {
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
      links: parseSpanLinks(colIndex, row),
    };
  });
}

/** Returns true if the column name belongs to the span links data */
function isSpanLinkColumn(colName: string): boolean {
  return (
    colName === "links.trace.id" ||
    colName === "links.span.id" ||
    colName.startsWith("links.attributes.")
  );
}

/**
 * Parse span links from a single ES|QL row.
 * Handles multi-value (array) fields for `links.trace.id` and `links.span.id`,
 * and zips them with any `links.attributes.*` columns.
 */
export function parseSpanLinks(colIndex: Map<string, number>, row: unknown[]): SpanLink[] {
  const getField = (field: string): unknown => {
    const idx = colIndex.get(field);
    return idx !== undefined ? row[idx] : null;
  };

  const rawTraceIds = getField("links.trace.id");
  const rawSpanIds = getField("links.span.id");

  if (rawTraceIds == null || rawSpanIds == null) return [];

  const traceIds = Array.isArray(rawTraceIds) ? rawTraceIds : [rawTraceIds];
  const spanIds = Array.isArray(rawSpanIds) ? rawSpanIds : [rawSpanIds];

  // Gather links.attributes.* columns sorted for deterministic order
  const attrCols: Array<[string, number]> = [];
  for (const [colName, idx] of colIndex) {
    if (colName.startsWith("links.attributes.")) {
      attrCols.push([colName, idx]);
    }
  }

  const count = Math.min(traceIds.length, spanIds.length);
  const links: SpanLink[] = [];

  for (let i = 0; i < count; i++) {
    if (traceIds[i] != null && spanIds[i] != null) {
      const attributes: Record<string, unknown> = {};
      for (const [colName, idx] of attrCols) {
        const rawVal = row[idx];
        const vals = Array.isArray(rawVal) ? rawVal : [rawVal];
        if (i < vals.length && vals[i] != null) {
          attributes[colName.slice("links.attributes.".length)] = vals[i];
        }
      }
      links.push({
        traceId: String(traceIds[i]),
        spanId: String(spanIds[i]),
        attributes,
      });
    }
  }

  return links;
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
