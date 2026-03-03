/**
 * Central hook managing span tree state: expansion, grouping, and flat row production.
 */
import { useState, useMemo, useCallback } from "react";

import type { Span, SpanTreeNode } from "../traceUtils";
import { buildSpanTree } from "../traceUtils";

import { identifySiblingGroups } from "./spanTreeGrouping";
import type { SpanTreeRowItem, GroupRun } from "./spanTreeTypes";

/** Detect whether spans represent search results (all roots) or trace detail */
export function isSearchResultsMode(spans: Span[]): boolean {
  if (spans.length === 0) return true;
  return spans.every((s) => s.parentSpanId === null || s.parentSpanId === "");
}

/** Build initial expanded set by expanding all nodes up to maxDepth */
function buildInitialExpandedSet(roots: SpanTreeNode[], maxDepth: number): Set<string> {
  const expanded = new Set<string>();
  function walk(node: SpanTreeNode): void {
    if (node.depth < maxDepth && node.children.length > 0) {
      expanded.add(node.span.spanId);
      for (const child of node.children) {
        walk(child);
      }
    }
  }
  for (const root of roots) {
    walk(root);
  }
  return expanded;
}

/** Check if a child index falls within any group run */
function findGroupRun(runs: GroupRun[] | undefined, index: number): GroupRun | null {
  if (!runs) return null;
  for (const run of runs) {
    if (index >= run.startIndex && index < run.startIndex + run.nodes.length) {
      return run;
    }
  }
  return null;
}

export function useSpanTree(
  spans: Span[],
  options: {
    autoCollapseThreshold?: number;
    defaultExpandDepth?: number;
  } = {},
) {
  const { autoCollapseThreshold = 3, defaultExpandDepth = 2 } = options;

  const searchMode = useMemo(() => isSearchResultsMode(spans), [spans]);

  const roots = useMemo(() => buildSpanTree(spans), [spans]);

  const groupMap = useMemo(
    () =>
      searchMode
        ? new Map<string, GroupRun[]>()
        : identifySiblingGroups(roots, autoCollapseThreshold),
    [roots, searchMode, autoCollapseThreshold],
  );

  const [expandedSet, setExpandedSet] = useState<Set<string>>(() =>
    searchMode ? new Set() : buildInitialExpandedSet(roots, defaultExpandDepth),
  );

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  // Reset expansion state when spans identity changes
  const spanFingerprint = useMemo(() => spans.map((s) => s.spanId).join(","), [spans]);
  const [lastFingerprint, setLastFingerprint] = useState(spanFingerprint);
  if (spanFingerprint !== lastFingerprint) {
    setLastFingerprint(spanFingerprint);
    setExpandedSet(searchMode ? new Set() : buildInitialExpandedSet(roots, defaultExpandDepth));
    setExpandedGroups(new Set());
  }

  const flatRows = useMemo((): SpanTreeRowItem[] => {
    const rows: SpanTreeRowItem[] = [];

    function emitNode(node: SpanTreeNode): void {
      const isExpanded = expandedSet.has(node.span.spanId);
      rows.push({
        type: "span",
        node,
        expanded: isExpanded,
        hasChildren: node.children.length > 0,
      });

      if (isExpanded && node.children.length > 0) {
        emitChildren(node.children, node.span.spanId);
      }
    }

    function emitChildren(children: SpanTreeNode[], parentId: string): void {
      const runs = groupMap.get(parentId);
      let i = 0;
      while (i < children.length) {
        const run = findGroupRun(runs, i);
        if (run && i === run.startIndex) {
          const isGroupExpanded = expandedGroups.has(run.key);
          if (isGroupExpanded) {
            // Expanded group: emit each span individually
            for (const node of run.nodes) {
              emitNode(node);
            }
          } else {
            // Collapsed group: emit single group row
            rows.push({
              type: "group",
              groupKey: run.key,
              parentId: run.parentId,
              spans: run.nodes,
              depth: run.nodes[0]?.depth ?? 0,
              expanded: false,
              stats: run.stats,
            });
          }
          i = run.startIndex + run.nodes.length;
        } else {
          emitNode(children[i]!);
          i++;
        }
      }
    }

    if (searchMode) {
      // Search results: flat list of roots, no expand/collapse
      for (const root of roots) {
        rows.push({
          type: "span",
          node: root,
          expanded: false,
          hasChildren: false,
        });
      }
    } else {
      emitChildren(roots, "__roots__");
    }

    return rows;
  }, [roots, expandedSet, expandedGroups, groupMap, searchMode]);

  const toggleExpand = useCallback((spanId: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) {
        next.delete(spanId);
      } else {
        next.add(spanId);
      }
      return next;
    });
  }, []);

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set<string>();
    function walk(node: SpanTreeNode): void {
      if (node.children.length > 0) {
        all.add(node.span.spanId);
        for (const child of node.children) {
          walk(child);
        }
      }
    }
    for (const root of roots) {
      walk(root);
    }
    setExpandedSet(all);

    // Also expand all groups
    const allGroups = new Set<string>();
    for (const runs of groupMap.values()) {
      for (const run of runs) {
        allGroups.add(run.key);
      }
    }
    setExpandedGroups(allGroups);
  }, [roots, groupMap]);

  const collapseAll = useCallback(() => {
    setExpandedSet(new Set());
    setExpandedGroups(new Set());
  }, []);

  return {
    flatRows,
    roots,
    searchMode,
    toggleExpand,
    toggleGroup,
    expandAll,
    collapseAll,
  };
}
