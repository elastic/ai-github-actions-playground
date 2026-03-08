import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import { COMPACT_CHIP_SX } from "../../types/tokens";
import { OverviewInfoCard } from "../OverviewInfoCard";

interface SnapshotKpiCardsProps {
  total: number;
  successCount: number;
  failedCount: number;
  inProgressCount: number;
}

export function SnapshotKpiCards({
  total,
  successCount,
  failedCount,
  inProgressCount,
}: SnapshotKpiCardsProps) {
  return (
    <Grid container spacing={1}>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Total Snapshots">
          <Typography variant="h5" component="div">
            {total}
          </Typography>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Successful">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h5" component="div">
              {successCount}
            </Typography>
            {successCount > 0 && (
              <Chip label={successCount} color="success" size="small" sx={COMPACT_CHIP_SX} />
            )}
          </Box>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Failed / Partial">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h5" component="div">
              {failedCount}
            </Typography>
            {failedCount > 0 && (
              <Chip label={failedCount} color="error" size="small" sx={COMPACT_CHIP_SX} />
            )}
          </Box>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="In Progress">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h5" component="div">
              {inProgressCount}
            </Typography>
            {inProgressCount > 0 && (
              <Chip label={inProgressCount} color="info" size="small" sx={COMPACT_CHIP_SX} />
            )}
          </Box>
        </OverviewInfoCard>
      </Grid>
    </Grid>
  );
}

interface PolicyKpiCardsProps {
  policyCount: number;
  totalTaken: number;
  totalFailed: number;
  retentionRuns: number;
}

export function PolicyKpiCards({
  policyCount,
  totalTaken,
  totalFailed,
  retentionRuns,
}: PolicyKpiCardsProps) {
  return (
    <Grid container spacing={1}>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Policies">
          <Typography variant="h5" component="div">
            {policyCount}
          </Typography>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Total Taken">
          <Typography variant="h5" component="div">
            {totalTaken}
          </Typography>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Total Failed">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="h5" component="div">
              {totalFailed}
            </Typography>
            {totalFailed > 0 && (
              <Chip label={totalFailed} color="error" size="small" sx={COMPACT_CHIP_SX} />
            )}
          </Box>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Retention Runs">
          <Typography variant="h5" component="div">
            {retentionRuns}
          </Typography>
        </OverviewInfoCard>
      </Grid>
    </Grid>
  );
}
