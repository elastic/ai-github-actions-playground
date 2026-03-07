import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import { OverviewInfoCard } from "./OverviewInfoCard";
import { formatNanos } from "./taskSortUtils";

interface TaskKpiCardsProps {
  count: number;
  cancellable: number;
  longRunning: number;
  oldestNanos: number;
}

export function KpiCards({ count, cancellable, longRunning, oldestNanos }: TaskKpiCardsProps) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Running Tasks">
          <Typography variant="h5" component="p">
            {count}
          </Typography>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Cancellable">
          <Typography variant="h5" component="p">
            {cancellable}
          </Typography>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Long-Running (>60s)">
          <Typography variant="h5" component="p">
            {longRunning}
          </Typography>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Oldest Task">
          <Typography variant="h5" component="p">
            {oldestNanos > 0 ? formatNanos(oldestNanos) : "—"}
          </Typography>
        </OverviewInfoCard>
      </Grid>
    </Grid>
  );
}
