import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import { formatBytes } from "../utils/formatBytes";

import { formatShardSplit, type TreeNode } from "./storageExplorerTreeUtils";

interface StorageExplorerDetailsDrawerProps {
  selectedNode: TreeNode | null;
  selectedNodeStats?: { totalBytes: number | null; usedBytes: number | null };
  onClose: () => void;
  onOpenIndex: (indexName: string) => void;
}

export default function StorageExplorerDetailsDrawer({
  selectedNode,
  selectedNodeStats,
  onClose,
  onOpenIndex,
}: StorageExplorerDetailsDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={Boolean(selectedNode)}
      onClose={onClose}
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
        <IconButton size="small" aria-label="Close storage details" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1, overflow: "auto" }}>
        {selectedNode && (
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
                onClick={() => {
                  const indexName = selectedNode.indexName;
                  if (indexName) onOpenIndex(indexName);
                }}
              >
                Open index in Indices
              </Button>
            )}
          </>
        )}
      </Box>
    </Drawer>
  );
}
