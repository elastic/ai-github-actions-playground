/**
 * Pure functions for identifying and aggregating consecutive sibling groups.
 * Does NOT mutate the span tree — returns a side-table of group runs.
 */
import type { SpanTreeNode } from "../traceUtils";
import { isErrorStatus } from "../traceUtils";

import type { GroupRun, GroupStats } from "./spanTreeTypes";

/** Build a grouping key from a span's service name and operation name */
function groupKey(node: SpanTreeNode): string {
  return `${node.span.serviceName}::${node.span.name}`;
}

/** Compute aggregate stats for a group of spans */
export function computeGroupStats(nodes: SpanTreeNode[]): GroupStats {
  let totalDurationUs = 0;
  let minDurationUs = Infinity;
  let maxDurationUs = -Infinity;
  let errorCount = 0;

  for (const node of nodes) {
    totalDurationUs += node.span.durationUs;
    if (node.span.durationUs < minDurationUs) minDurationUs = node.span.durationUs;
    if (node.span.durationUs > maxDurationUs) maxDurationUs = node.span.durationUs;
    if (isErrorStatus(node.span.status)) errorCount++;
  }

  return {
    count: nodes.length,
    totalDurationUs,
    minDurationUs: nodes.length > 0 ? minDurationUs : 0,
    maxDurationUs: nodes.length > 0 ? maxDurationUs : 0,
    errorCount,
    serviceName: nodes[0]?.span.serviceName ?? "",
    operationName: nodes[0]?.span.name ?? "",
  };
}

/**
 * Identify consecutive sibling groups across the entire tree.
 * Returns a Map from parentId (or "__roots__" for root-level) to GroupRun[].
 *
 * A group is created when `threshold` or more consecutive children share the
 * same `serviceName::name` key.
 */
export function identifySiblingGroups(
  roots: SpanTreeNode[],
  threshold: number,
): Map<string, GroupRun[]> {
  const result = new Map<string, GroupRun[]>();

  function processChildren(children: SpanTreeNode[], parentId: string): void {
    if (children.length < threshold) {
      // Not enough children to form any group; still recurse into each child
      for (const child of children) {
        if (child.children.length > 0) {
          processChildren(child.children, child.span.spanId);
        }
      }
      return;
    }

    const runs: GroupRun[] = [];
    let runStart = 0;
    let runKey = groupKey(children[0]!);

    for (let i = 1; i <= children.length; i++) {
      const currentKey = i < children.length ? groupKey(children[i]!) : null;
      if (currentKey !== runKey) {
        // End of a run
        const runLength = i - runStart;
        if (runLength >= threshold) {
          const nodes = children.slice(runStart, i);
          runs.push({
            key: `${parentId}::${runKey}::${runStart}`,
            parentId,
            startIndex: runStart,
            nodes,
            stats: computeGroupStats(nodes),
          });
        }
        runStart = i;
        runKey = currentKey ?? "";
      }
    }

    if (runs.length > 0) {
      result.set(parentId, runs);
    }

    // Recurse into all children (including grouped ones — they may have their own sub-groups)
    for (const child of children) {
      if (child.children.length > 0) {
        processChildren(child.children, child.span.spanId);
      }
    }
  }

  // Process root-level spans
  if (roots.length >= threshold) {
    processChildren(roots, "__roots__");
  } else {
    for (const root of roots) {
      if (root.children.length > 0) {
        processChildren(root.children, root.span.spanId);
      }
    }
  }

  return result;
}
