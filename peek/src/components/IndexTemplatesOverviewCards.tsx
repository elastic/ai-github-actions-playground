import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import { OverviewInfoCard } from "./OverviewInfoCard";
import { HIGH_PRIORITY_THRESHOLD } from "./indexTemplatesPageHelpers";

interface IndexTemplatesOverviewCardsProps {
  visibleIndexTemplatesCount: number;
  visibleComponentTemplatesCount: number;
  dataStreamEnabledCount: number;
  highPriorityCount: number;
}

export default function IndexTemplatesOverviewCards({
  visibleIndexTemplatesCount,
  visibleComponentTemplatesCount,
  dataStreamEnabledCount,
  highPriorityCount,
}: IndexTemplatesOverviewCardsProps) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Index Templates">
          <Typography variant="h3" component="p">
            {visibleIndexTemplatesCount}
          </Typography>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Component Templates">
          <Typography variant="h3" component="p">
            {visibleComponentTemplatesCount}
          </Typography>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Data-Stream Enabled">
          <Typography variant="h3" component="p">
            {dataStreamEnabledCount}
          </Typography>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title={`High Priority (≥${HIGH_PRIORITY_THRESHOLD})`}>
          <Typography variant="h3" component="p">
            {highPriorityCount}
          </Typography>
        </OverviewInfoCard>
      </Grid>
    </Grid>
  );
}
