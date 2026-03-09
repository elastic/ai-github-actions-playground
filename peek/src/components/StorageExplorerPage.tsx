import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import StorageIcon from "@mui/icons-material/Storage";

import { useStorageExplorerData } from "../hooks/useStorageExplorerData";

import DocLink from "./DocLink";
import EmptyState from "./EmptyState";
import LoadingButton from "./LoadingButton";
import PageContainer from "./PageContainer";
import PageHeaderSection from "./PageHeaderSection";
import StorageExplorerDetailsDrawer from "./StorageExplorerDetailsDrawer";
import StorageExplorerGroupChooser from "./StorageExplorerGroupChooser";
import StorageExplorerSummaryCards from "./StorageExplorerSummaryCards";
import StorageExplorerTreePanel from "./StorageExplorerTreePanel";
import {
  aggregateTree,
  flattenTreeRows,
  sortByBytesThenLabel,
  uniquePreviewValues,
  type GroupBy,
  type TreeNode,
} from "./storageExplorerTreeUtils";

export default function StorageExplorerPage() {
  const navigate = useNavigate();
  const { result, partialErrors, refresh } = useStorageExplorerData();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
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
    const term = deferredSearch.trim().toLowerCase();
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
  }, [data.shards, partialErrors, deferredSearch, showReplicas, showSystemIndices]);

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

  const rows = useMemo(
    () => flattenTreeRows({ expanded, rootNodes, tree }),
    [expanded, rootNodes, tree],
  );

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
    <PageContainer>
      <PageHeaderSection
        title="Storage Explorer"
        titleAdornment={<DocLink section="storage-explorer" tooltip="Storage Explorer docs" />}
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

      {partialErrors.length > 0 && (
        <Alert severity="warning">
          Partial data loaded: failed to fetch {partialErrors.join(", ")}.
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {!loading && summary.shardCopies > 0 && (
        <StorageExplorerSummaryCards
          clusterTotalStorageBytes={clusterTotalStorageBytes}
          nodes={summary.nodes}
          shardCopies={summary.shardCopies}
          primaries={summary.primaries}
          replicas={summary.replicas}
          totalShardStore={summary.totalShardStore}
        />
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
        <StorageExplorerGroupChooser
          chooserPreviews={chooserPreviews}
          onSelectGroupBy={handleSetGroupBy}
        />
      )}

      {hasShards && groupBy && (
        <StorageExplorerTreePanel
          loading={loading}
          search={search}
          rows={rows}
          selectedNode={selectedNode}
          expanded={expanded}
          showReplicas={showReplicas}
          showSystemIndices={showSystemIndices}
          clusterTotalStorageBytes={clusterTotalStorageBytes}
          onSearchChange={setSearch}
          onShowReplicasChange={setShowReplicas}
          onShowSystemIndicesChange={setShowSystemIndices}
          onSelectNode={setSelectedId}
          onToggleExpanded={toggleExpanded}
        />
      )}

      <StorageExplorerDetailsDrawer
        selectedNode={selectedNode}
        selectedNodeStats={selectedNodeStats}
        onClose={() => setSelectedId(null)}
        onOpenIndex={(indexName) => navigate(`/indices?search=${encodeURIComponent(indexName)}`)}
      />
    </PageContainer>
  );
}
