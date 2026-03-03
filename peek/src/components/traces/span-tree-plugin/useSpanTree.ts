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
  const visited = new Set<string>();
  function walk(node: SpanTreeNode): void {
    if (visited.has(node.span.spanId)) return;
    visited.add(node.span.spanId);
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

/** Expansion state, keyed to a fingerprint so resets are atomic */
interface ExpansionState {
  fingerprint: string;
  expandedSet: Set<string>;
  expandedGroups: Set<string>;
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

  const spanFingerprint = useMemo(() => spans.map((s) => s.spanId).join(","), [spans]);

  const [expansion, setExpansion] = useState<ExpansionState>(() => ({
    fingerprint: spanFingerprint,
    expandedSet: searchMode ? new Set() : buildInitialExpandedSet(roots, defaultExpandDepth),
    expandedGroups: new Set(),
  }));

  // When the span set changes, reset expansion atomically in a single setState call.
  // Calling setState during rendering is the React-approved pattern for derived state resets
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  // Note: setState-in-effect is disallowed by the project's ESLint rules.
  let { expandedSet, expandedGroups } = expansion;
  if (expansion.fingerprint !== spanFingerprint) {
    const reset: ExpansionState = {
      fingerprint: spanFingerprint,
      expandedSet: searchMode
        ? new Set<string>()
        : buildInitialExpandedSet(roots, defaultExpandDepth),
      expandedGroups: new Set<string>(),
    };
    setExpansion(reset);
    expandedSet = reset.expandedSet;
    expandedGroups = reset.expandedGroups;
  }

  const flatRows = useMemo((): SpanTreeRowItem[] => {
    const rows: SpanTreeRowItem[] = [];
    const visited = new Set<string>();

    function emitNode(node: SpanTreeNode): void {
      if (visited.has(node.span.spanId)) return;
      visited.add(node.span.spanId);
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
    setExpansion((prev) => {
      const next = new Set(prev.expandedSet);
      if (next.has(spanId)) {
        next.delete(spanId);
      } else {
        next.add(spanId);
      }
      return { ...prev, expandedSet: next };
    });
  }, []);

  const toggleGroup = useCallback((groupKey: string) => {
    setExpansion((prev) => {
      const next = new Set(prev.expandedGroups);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return { ...prev, expandedGroups: next };
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set<string>();
    const visited = new Set<string>();
    function walk(node: SpanTreeNode): void {
      if (visited.has(node.span.spanId)) return;
      visited.add(node.span.spanId);
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

    const allGroups = new Set<string>();
    for (const runs of groupMap.values()) {
      for (const run of runs) {
        allGroups.add(run.key);
      }
    }
    setExpansion((prev) => ({ ...prev, expandedSet: all, expandedGroups: allGroups }));
  }, [roots, groupMap]);

  const collapseAll = useCallback(() => {
    setExpansion((prev) => ({
      ...prev,
      expandedSet: new Set(),
      expandedGroups: new Set(),
    }));
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
