import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { formatBytes } from "../utils/formatBytes";

import { OverviewInfoCard } from "./OverviewInfoCard";

interface StorageExplorerSummaryCardsProps {
  clusterTotalStorageBytes: number;
  nodes: number;
  shardCopies: number;
  primaries: number;
  replicas: number;
  totalShardStore: number;
}

export default function StorageExplorerSummaryCards({
  clusterTotalStorageBytes,
  nodes,
  shardCopies,
  primaries,
  replicas,
  totalShardStore,
}: StorageExplorerSummaryCardsProps) {
  return (
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
            {nodes}
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
            {shardCopies.toLocaleString()}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ flex: 1, minWidth: 120 }}>
        <OverviewInfoCard title="Primary copies">
          <Typography variant="h5" component="p" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {primaries.toLocaleString()}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ flex: 1, minWidth: 120 }}>
        <OverviewInfoCard title="Replica copies">
          <Typography variant="h5" component="p" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {replicas.toLocaleString()}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ flex: 1, minWidth: 120 }}>
        <OverviewInfoCard title="Shard store">
          <Typography variant="h5" component="p" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {formatBytes(totalShardStore)}
          </Typography>
        </OverviewInfoCard>
      </Box>
    </Stack>
  );
}
