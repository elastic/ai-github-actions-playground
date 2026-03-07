import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LoadingButton from "./LoadingButton";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CategoryIcon from "@mui/icons-material/Category";
import CloseIcon from "@mui/icons-material/Close";
import DnsIcon from "@mui/icons-material/Dns";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import TagIcon from "@mui/icons-material/Tag";
import StorageIcon from "@mui/icons-material/Storage";

import { useStorageExplorerData, type StorageExplorerShard } from "../hooks/useStorageExplorerData";
import { formatBytes } from "../utils/formatBytes";

import EmptyState from "./EmptyState";
import { OverviewInfoCard } from "./OverviewInfoCard";
import PageHeader from "./PageHeader";

type TreeLevel = "node" | "signal" | "dataset" | "namespace" | "index" | "shard";
type GroupBy = "instance" | "type" | "namespace";

interface TreeNode {
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

interface FlatTreeRow {
  node: TreeNode;
  parent: TreeNode | null;
}

function sortByBytesThenLabel(a: TreeNode, b: TreeNode): number {
  if (b.storeBytes !== a.storeBytes) return b.storeBytes - a.storeBytes;
  return a.label.localeCompare(b.label);
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)}%`;
}

function formatShardSplit(primaries: number, replicas: number): string {
  const total = primaries + replicas;
  return `${total} (${primaries}/${replicas})`;
}

function uniquePreviewValues(values: string[], max = 3): string[] {
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

const GROUP_BY_META: Record<
  GroupBy,
  { label: string; help: string; icon: React.ReactNode; ariaLabel: string; description: string }
> = {
  instance: {
    label: "Instance",
    help: "Start at node/instance.",
    description:
      "Explore storage by Elasticsearch node first, then drill into telemetry and indices.",
    icon: <DnsIcon fontSize="small" />,
    ariaLabel: "Group by instance",
  },
  type: {
    label: "Type",
    help: "Start at signal type (logs, metrics, traces).",
    description: "Explore your storage based on telemetry type (logs, metrics, or traces).",
    icon: <CategoryIcon fontSize="small" />,
    ariaLabel: "Group by type",
  },
  namespace: {
    label: "Namespace",
    help: "Start at data stream namespace (for example default, prod).",
    description: "Explore storage by namespace so environments and tenants are easy to compare.",
    icon: <TagIcon fontSize="small" />,
    ariaLabel: "Group by namespace",
  },
};

function mergeNodeNames(existing: string[], nextName: string): string[] {
  if (existing.includes(nextName)) return existing;
  return [...existing, nextName].sort((a, b) => a.localeCompare(b));
}

function aggregateTree(shards: StorageExplorerShard[], groupBy: GroupBy) {
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
    const pathSegments: string[] = [];
    for (const [i, level] of levels.entries()) {
      const info = segmentInfo(level, shard);
      pathSegments.push(info.segment);
      const id = pathSegments.join("|");
      const parentId = i === 0 ? null : pathSegments.slice(0, i).join("|");
      const treeNode = upsertNode(
        id,
        parentId,
        i,
        level,
        info.label,
        shard.node,
        info.indexName,
        level === "shard" ? shard.state : null,
        level === "shard" ? shard.prirep.toLowerCase() : null,
      );
      levelNodes.push(treeNode);
    }

    for (const current of levelNodes) {
      addShardToNode(current, shard);
    }
  }

  for (const node of nodesById.values()) {
    node.children.sort((aId, bId) => {
      const a = nodesById.get(aId);
      const b = nodesById.get(bId);
      if (!a || !b) return 0;
      return sortByBytesThenLabel(a, b);
    });
  }

  return nodesById;
}

export default function StorageExplorerPage() {
  const navigate = useNavigate();
  const { result, partialErrors, refresh } = useStorageExplorerData();
  const [search, setSearch] = useState("");
  const [showReplicas, setShowReplicas] = useState(true);
  const [showSystemIndices, setShowSystemIndices] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loading = result.status === "loading";
  const error = result.status === "error" ? result.error : null;
  const data = result.status === "success" ? result.data : { nodes: [], shards: [] };
  const hasShards = data.shards.length > 0;

  const filteredShards = useMemo(() => {
    const term = search.trim().toLowerCase();
    const dataStreamsUnavailable = partialErrors.includes("data streams");
    return data.shards.filter((shard) => {
      if (!showReplicas && shard.prirep.toLowerCase() === "r") return false;
      if (
        !showSystemIndices &&
        !dataStreamsUnavailable &&
        shard.index.startsWith(".") &&
        !shard.index.startsWith(".ds-") &&
        !shard.dataStream
      ) {
        return false;
      }
      if (!term) return true;
      const text =
        `${shard.node} ${shard.signal} ${shard.dataset} ${shard.namespace} ${shard.index} ${shard.shard}`.toLowerCase();
      return text.includes(term);
    });
  }, [data.shards, partialErrors, search, showReplicas, showSystemIndices]);

  const tree = useMemo(
    () => (groupBy ? aggregateTree(filteredShards, groupBy) : new Map<string, TreeNode>()),
    [filteredShards, groupBy],
  );

  const nodeStatsByName = useMemo(() => {
    const map = new Map<string, { totalBytes: number | null; usedBytes: number | null }>();
    for (const node of data.nodes) {
      map.set(node.name, { totalBytes: node.totalBytes, usedBytes: node.usedBytes });
    }
    return map;
  }, [data.nodes]);

  const rootNodes = useMemo(
    () =>
      Array.from(tree.values())
        .filter((node) => node.parentId === null)
        .sort(sortByBytesThenLabel),
    [tree],
  );

  const rows = useMemo(() => {
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
  }, [expanded, rootNodes, tree]);

  const selectedNode = selectedId && tree.has(selectedId) ? (tree.get(selectedId) ?? null) : null;

  const selectedNodeStats =
    selectedNode && selectedNode.nodeNames.length === 1
      ? nodeStatsByName.get(selectedNode.nodeNames[0] ?? "")
      : undefined;

  const summary = useMemo(() => {
    const totalShardStore = filteredShards.reduce((sum, shard) => sum + shard.storeBytes, 0);
    return {
      nodes: new Set(filteredShards.map((shard) => shard.node)).size,
      shardCopies: filteredShards.length,
      totalShardStore,
      primaries: filteredShards.filter((shard) => shard.prirep.toLowerCase() === "p").length,
      replicas: filteredShards.filter((shard) => shard.prirep.toLowerCase() === "r").length,
    };
  }, [filteredShards]);

  const clusterTotalStorageBytes = useMemo(
    () => data.nodes.reduce((sum, node) => sum + (node.totalBytes ?? 0), 0),
    [data.nodes],
  );

  const chooserPreviews = useMemo(() => {
    const previewShards = data.shards.filter(
      (shard) => !shard.index.startsWith(".") || Boolean(shard.dataStream),
    );
    return {
      instance: uniquePreviewValues(previewShards.map((shard) => shard.node)),
      type: uniquePreviewValues(previewShards.map((shard) => shard.signal)),
      namespace: uniquePreviewValues(previewShards.map((shard) => shard.namespace)),
    };
  }, [data.shards]);

  const toggleExpanded = useCallback((id: string, currentlyExpanded: boolean) => {
    setExpanded((prev) => ({ ...prev, [id]: !currentlyExpanded }));
  }, []);

  const handleSetGroupBy = useCallback((nextGroupBy: GroupBy) => {
    setGroupBy(nextGroupBy);
    setExpanded({});
    setSelectedId(null);
  }, []);

  const handleChangeView = useCallback(() => {
    setGroupBy(null);
    setExpanded({});
    setSelectedId(null);
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Storage Explorer"
          description="Explore shard-copy storage by node, signal, dataset, namespace, index, and shard."
          actions={
            <>
              {groupBy && (
                <Button size="small" variant="outlined" onClick={handleChangeView}>
                  Change View
                </Button>
              )}
              <LoadingButton
                size="small"
                variant="outlined"
                onClick={refresh}
                loading={loading}
                aria-label={
                  loading ? "Refreshing storage explorer data" : "Refresh storage explorer data"
                }
              >
                {loading ? "Refreshing..." : "Refresh"}
              </LoadingButton>
            </>
          }
        />
      </Paper>

      {partialErrors.length > 0 && (
        <Alert severity="warning">
          Partial data loaded: failed to fetch {partialErrors.join(", ")}.
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && summary.shardCopies > 0 && (
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <OverviewInfoCard title="Total storage">
              <Typography variant="h5" component="p" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {formatBytes(clusterTotalStorageBytes)}
              </Typography>
            </OverviewInfoCard>
          </Box>
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <OverviewInfoCard title="Nodes">
              <Typography variant="h5" component="p" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {summary.nodes}
              </Typography>
            </OverviewInfoCard>
          </Box>
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <OverviewInfoCard title="Shard copies">
              <Typography
                variant="h5"
                component="p"
                data-testid="storage-shard-copies"
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {summary.shardCopies.toLocaleString()}
              </Typography>
            </OverviewInfoCard>
          </Box>
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <OverviewInfoCard title="Primary copies">
              <Typography variant="h5" component="p" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {summary.primaries.toLocaleString()}
              </Typography>
            </OverviewInfoCard>
          </Box>
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <OverviewInfoCard title="Replica copies">
              <Typography variant="h5" component="p" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {summary.replicas.toLocaleString()}
              </Typography>
            </OverviewInfoCard>
          </Box>
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <OverviewInfoCard title="Shard store">
              <Typography variant="h5" component="p" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {formatBytes(summary.totalShardStore)}
              </Typography>
            </OverviewInfoCard>
          </Box>
        </Stack>
      )}

      {!loading && !error && !hasShards && (
        <Paper variant="outlined" sx={{ p: 2, flex: 1, minHeight: 0 }}>
          <EmptyState
            icon={<StorageIcon sx={{ fontSize: 28 }} />}
            heading="No storage data found"
            description="No shard storage data is available for this cluster yet."
          />
        </Paper>
      )}

      {hasShards && !groupBy && (
        <Paper variant="outlined" sx={{ p: 2, flex: 1, minHeight: 0, overflow: "auto" }}>
          <Typography variant="h6" component="h2" gutterBottom>
            How would you like to slice it?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Pick how you want to start the storage tree. You can change this from the controls above
            the table.
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            sx={{ mt: 2 }}
          >
            <Button
              variant="outlined"
              size="large"
              onClick={() => handleSetGroupBy("instance")}
              aria-label={GROUP_BY_META.instance.ariaLabel}
              startIcon={GROUP_BY_META.instance.icon}
              sx={{
                minHeight: 120,
                p: 1.5,
                justifyContent: "flex-start",
                width: { xs: "100%", sm: "auto" },
                flex: { sm: "1 1 260px" },
                textAlign: "left",
                textTransform: "none",
                color: "text.primary",
                bgcolor: "background.paper",
                borderColor: "border.subtle",
                "&:hover": {
                  bgcolor: "action.hover",
                  borderColor: "text.secondary",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 0.5,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {GROUP_BY_META.instance.label}
                </Typography>
                <Typography variant="caption" sx={{ textTransform: "none", lineHeight: 1.25 }}>
                  {GROUP_BY_META.instance.description}
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                  {chooserPreviews.instance.length > 0 ? (
                    chooserPreviews.instance.map((value) => (
                      <Chip
                        key={`preview-instance-${value}`}
                        size="small"
                        label={value}
                        sx={{
                          height: 18,
                          bgcolor: "action.selected",
                          color: "text.primary",
                          border: 1,
                          borderColor: "border.subtle",
                        }}
                      />
                    ))
                  ) : (
                    <Typography variant="caption" sx={{ textTransform: "none", opacity: 0.9 }}>
                      No instance examples yet
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => handleSetGroupBy("type")}
              aria-label={GROUP_BY_META.type.ariaLabel}
              startIcon={GROUP_BY_META.type.icon}
              sx={{
                minHeight: 120,
                p: 1.5,
                justifyContent: "flex-start",
                width: { xs: "100%", sm: "auto" },
                flex: { sm: "1 1 260px" },
                textAlign: "left",
                textTransform: "none",
                color: "text.primary",
                bgcolor: "background.paper",
                borderColor: "border.subtle",
                "&:hover": {
                  bgcolor: "action.hover",
                  borderColor: "text.secondary",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 0.5,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {GROUP_BY_META.type.label}
                </Typography>
                <Typography variant="caption" sx={{ textTransform: "none", lineHeight: 1.25 }}>
                  {GROUP_BY_META.type.description}
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                  {chooserPreviews.type.length > 0 ? (
                    chooserPreviews.type.map((value) => (
                      <Chip
                        key={`preview-type-${value}`}
                        size="small"
                        label={value}
                        sx={{
                          height: 18,
                          bgcolor: "action.selected",
                          color: "text.primary",
                          border: 1,
                          borderColor: "border.subtle",
                        }}
                      />
                    ))
                  ) : (
                    <Typography variant="caption" sx={{ textTransform: "none", opacity: 0.9 }}>
                      No telemetry type examples yet
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => handleSetGroupBy("namespace")}
              aria-label={GROUP_BY_META.namespace.ariaLabel}
              startIcon={GROUP_BY_META.namespace.icon}
              sx={{
                minHeight: 120,
                p: 1.5,
                justifyContent: "flex-start",
                width: { xs: "100%", sm: "auto" },
                flex: { sm: "1 1 260px" },
                textAlign: "left",
                textTransform: "none",
                color: "text.primary",
                bgcolor: "background.paper",
                borderColor: "border.subtle",
                "&:hover": {
                  bgcolor: "action.hover",
                  borderColor: "text.secondary",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 0.5,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {GROUP_BY_META.namespace.label}
                </Typography>
                <Typography variant="caption" sx={{ textTransform: "none", lineHeight: 1.25 }}>
                  {GROUP_BY_META.namespace.description}
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                  {chooserPreviews.namespace.length > 0 ? (
                    chooserPreviews.namespace.map((value) => (
                      <Chip
                        key={`preview-namespace-${value}`}
                        size="small"
                        label={value}
                        sx={{
                          height: 18,
                          bgcolor: "action.selected",
                          color: "text.primary",
                          border: 1,
                          borderColor: "border.subtle",
                        }}
                      />
                    ))
                  ) : (
                    <Typography variant="caption" sx={{ textTransform: "none", opacity: 0.9 }}>
                      No namespace examples yet
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Button>
          </Stack>
        </Paper>
      )}

      {hasShards && groupBy && (
        <Paper
          variant="outlined"
          sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
        >
          <Box sx={{ p: 1, borderBottom: 1, borderColor: "border.subtle" }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search node, signal, dataset, namespace, index, or shard"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              inputProps={{ "aria-label": "Search storage explorer tree" }}
            />
            <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={showReplicas}
                    onChange={(event) => setShowReplicas(event.target.checked)}
                    inputProps={{ "aria-label": "Show replica shard copies" }}
                  />
                }
                label={
                  <Typography variant="caption" color="text.secondary">
                    Show replicas
                  </Typography>
                }
                sx={{ ml: 0 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={showSystemIndices}
                    onChange={(event) => setShowSystemIndices(event.target.checked)}
                    inputProps={{ "aria-label": "Show system indices" }}
                  />
                }
                label={
                  <Typography variant="caption" color="text.secondary">
                    Show system indices
                  </Typography>
                }
                sx={{ ml: 0 }}
              />
            </Stack>
          </Box>
          <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <Table size="small" stickyHeader aria-label="Storage explorer tree">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell align="right">Shards (P/R)</TableCell>
                  <TableCell align="right">Store</TableCell>
                  <TableCell align="right">Store (%)</TableCell>
                  <TableCell>State</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(({ node }) => {
                  const hasChildren = node.children.length > 0;
                  const isExpanded = expanded[node.id] ?? node.depth < 2;
                  const percentOfClusterStorage =
                    clusterTotalStorageBytes > 0
                      ? (node.storeBytes / clusterTotalStorageBytes) * 100
                      : null;
                  return (
                    <TableRow
                      key={node.id}
                      hover
                      selected={selectedNode?.id === node.id}
                      aria-selected={selectedNode?.id === node.id}
                      onClick={() => setSelectedId(node.id)}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " " || event.code === "Space") {
                          event.preventDefault();
                          setSelectedId(node.id);
                        }
                      }}
                      sx={{
                        cursor: "pointer",
                        "&:focus-visible": {
                          outline: "2px solid",
                          outlineColor: "primary.main",
                          outlineOffset: -2,
                        },
                      }}
                    >
                      <TableCell>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            pl: node.depth * 2,
                            gap: 0.5,
                            minWidth: 0,
                          }}
                        >
                          {hasChildren ? (
                            <IconButton
                              size="small"
                              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.label}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleExpanded(node.id, isExpanded);
                              }}
                            >
                              {isExpanded ? (
                                <KeyboardArrowDownIcon fontSize="small" />
                              ) : (
                                <KeyboardArrowRightIcon fontSize="small" />
                              )}
                            </IconButton>
                          ) : (
                            <Box sx={{ width: 30 }} />
                          )}
                          <Typography
                            variant="body2"
                            noWrap
                            title={node.label}
                            sx={{ minWidth: 0 }}
                          >
                            {node.label}
                          </Typography>
                          {node.level === "shard" && (
                            <Chip
                              size="small"
                              label={node.prirep === "p" ? "P" : "R"}
                              color={node.prirep === "p" ? "primary" : "default"}
                              sx={{ height: 18 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatShardSplit(node.primaries, node.replicas)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{formatBytes(node.storeBytes)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {formatPercent(percentOfClusterStorage)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{node.state ?? "—"}</Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ border: 0 }}>
                      <EmptyState
                        size="small"
                        icon={<StorageIcon sx={{ fontSize: 28 }} />}
                        heading="No storage rows found"
                        description="Try adjusting filters or verify shard data is available in the connected cluster."
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Drawer
        anchor="right"
        open={Boolean(selectedNode)}
        onClose={() => setSelectedId(null)}
        PaperProps={{
          sx: {
            width: { xs: "100%", md: 440 },
            p: 1,
            backgroundColor: "background.default",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1 }}>
          <Typography variant="subtitle1">Storage details</Typography>
          <IconButton
            size="small"
            aria-label="Close storage details"
            onClick={() => setSelectedId(null)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1, overflow: "auto" }}>
          {selectedNode ? (
            <>
              <Typography variant="body2" sx={{ fontWeight: 600 }} title={selectedNode.label}>
                {selectedNode.label}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "minmax(120px, auto) 1fr",
                  columnGap: 1.5,
                  rowGap: 0.5,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Level
                </Typography>
                <Typography variant="body2">{selectedNode.level}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Node scope
                </Typography>
                <Typography variant="body2">
                  {selectedNode.nodeNames.length === 1
                    ? selectedNode.nodeNames[0]
                    : `${selectedNode.nodeNames.length} nodes`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Shards (P/R)
                </Typography>
                <Typography variant="body2">
                  {formatShardSplit(selectedNode.primaries, selectedNode.replicas)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Primaries
                </Typography>
                <Typography variant="body2">{selectedNode.primaries.toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Replicas
                </Typography>
                <Typography variant="body2">{selectedNode.replicas.toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Store
                </Typography>
                <Typography variant="body2">{formatBytes(selectedNode.storeBytes)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Docs
                </Typography>
                <Typography variant="body2">{selectedNode.docs.toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Node used
                </Typography>
                <Typography variant="body2">
                  {formatBytes(selectedNodeStats?.usedBytes ?? null)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Node total
                </Typography>
                <Typography variant="body2">
                  {formatBytes(selectedNodeStats?.totalBytes ?? null)}
                </Typography>
              </Box>
              {selectedNode.level === "index" && selectedNode.indexName && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    navigate(`/indices?search=${encodeURIComponent(selectedNode.indexName ?? "")}`)
                  }
                >
                  Open index in Indices
                </Button>
              )}
            </>
          ) : (
            <EmptyState
              size="small"
              icon={<StorageIcon sx={{ fontSize: 28 }} />}
              heading="No selection"
              description="Select a row in the tree to inspect aggregate storage details."
            />
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
