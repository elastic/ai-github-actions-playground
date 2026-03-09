import type { StorageExplorerShard } from "../hooks/useStorageExplorerData";

export type TreeLevel = "node" | "signal" | "dataset" | "namespace" | "index" | "shard";
export type GroupBy = "instance" | "type" | "namespace";

export interface TreeNode {
  id: string;
  parentId: string | null;
  depth: number;
  level: TreeLevel;
  label: string;
  storeBytes: number;
  docs: number;
  shardCopies: number;
  primaries: number;
  replicas: number;
  state: string | null;
  prirep: string | null;
  nodeNames: string[];
  indexName: string | null;
  children: string[];
}

export interface FlatTreeRow {
  node: TreeNode;
  parent: TreeNode | null;
}

export function sortByBytesThenLabel(a: TreeNode, b: TreeNode): number {
  if (b.storeBytes !== a.storeBytes) return b.storeBytes - a.storeBytes;
  return a.label.localeCompare(b.label);
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

export function formatShardSplit(primaries: number, replicas: number): string {
  const total = primaries + replicas;
  return `${total} (${primaries}/${replicas})`;
}

export function uniquePreviewValues(values: string[], max = 3): string[] {
  const set = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (trimmed === "n/a") continue;
    set.add(trimmed);
    if (set.size >= max) break;
  }
  return Array.from(set);
}

function mergeNodeNames(existing: string[], nextName: string): string[] {
  if (existing.includes(nextName)) return existing;
  return [...existing, nextName];
}

export function aggregateTree(shards: StorageExplorerShard[], groupBy: GroupBy) {
  const nodesById = new Map<string, TreeNode>();
  const levelOrder: Record<GroupBy, TreeLevel[]> = {
    instance: ["node", "signal", "dataset", "namespace", "index", "shard"],
    type: ["signal", "dataset", "namespace", "node", "index", "shard"],
    namespace: ["namespace", "signal", "dataset", "node", "index", "shard"],
  };

  const upsertNode = (
    id: string,
    parentId: string | null,
    depth: number,
    level: TreeLevel,
    label: string,
    nodeName: string,
    indexName: string | null,
    state: string | null = null,
    prirep: string | null = null,
  ): TreeNode => {
    let current = nodesById.get(id);
    if (!current) {
      current = {
        id,
        parentId,
        depth,
        level,
        label,
        storeBytes: 0,
        docs: 0,
        shardCopies: 0,
        primaries: 0,
        replicas: 0,
        state,
        prirep,
        nodeNames: [nodeName],
        indexName,
        children: [],
      };
      nodesById.set(id, current);
      if (parentId) {
        const parent = nodesById.get(parentId);
        if (parent) parent.children.push(id);
      }
    }
    current.nodeNames = mergeNodeNames(current.nodeNames, nodeName);
    return current;
  };

  const addShardToNode = (node: TreeNode, shard: StorageExplorerShard) => {
    node.storeBytes += shard.storeBytes;
    if (node.level === "shard" || shard.prirep.toLowerCase() === "p") {
      node.docs += shard.docs;
    }
    node.shardCopies += 1;
    if (shard.prirep.toLowerCase() === "p") node.primaries += 1;
    if (shard.prirep.toLowerCase() === "r") node.replicas += 1;
  };

  const segmentInfo = (level: TreeLevel, shard: StorageExplorerShard) => {
    switch (level) {
      case "node":
        return { segment: `node:${shard.node}`, label: shard.node, indexName: null };
      case "signal":
        return { segment: `signal:${shard.signal}`, label: shard.signal, indexName: null };
      case "dataset":
        return { segment: `dataset:${shard.dataset}`, label: shard.dataset, indexName: null };
      case "namespace":
        return { segment: `namespace:${shard.namespace}`, label: shard.namespace, indexName: null };
      case "index":
        return { segment: `index:${shard.index}`, label: shard.index, indexName: shard.index };
      case "shard":
        return {
          segment: `shard:${shard.shard}:${shard.prirep.toLowerCase()}`,
          label: `shard ${shard.shard} (${shard.prirep.toLowerCase() === "p" ? "primary" : "replica"})`,
          indexName: shard.index,
        };
    }
  };

  for (const shard of shards) {
    const levels = levelOrder[groupBy];
    const levelNodes: TreeNode[] = [];
    let parentId: string | null = null;

    for (const [index, level] of levels.entries()) {
      const info = segmentInfo(level, shard);
      const id: string = parentId ? `${parentId}|${info.segment}` : info.segment;
      const treeNode = upsertNode(
        id,
        parentId,
        index,
        level,
        info.label,
        shard.node,
        info.indexName,
        level === "shard" ? shard.state : null,
        level === "shard" ? shard.prirep.toLowerCase() : null,
      );
      levelNodes.push(treeNode);
      parentId = id;
    }

    for (const current of levelNodes) {
      addShardToNode(current, shard);
    }
  }

  for (const node of nodesById.values()) {
    node.nodeNames.sort((a, b) => a.localeCompare(b));
    node.children.sort((aId, bId) => {
      const a = nodesById.get(aId);
      const b = nodesById.get(bId);
      if (!a || !b) return 0;
      return sortByBytesThenLabel(a, b);
    });
  }

  return nodesById;
}

export function flattenTreeRows({
  expanded,
  rootNodes,
  tree,
}: {
  expanded: Record<string, boolean>;
  rootNodes: TreeNode[];
  tree: Map<string, TreeNode>;
}): FlatTreeRow[] {
  const flattened: FlatTreeRow[] = [];
  const walk = (node: TreeNode, parent: TreeNode | null) => {
    flattened.push({ node, parent });
    const isExpanded = expanded[node.id] ?? node.depth < 2;
    if (!isExpanded) return;
    for (const childId of node.children) {
      const child = tree.get(childId);
      if (child) walk(child, node);
    }
  };

  for (const root of rootNodes) walk(root, null);
  return flattened;
}
