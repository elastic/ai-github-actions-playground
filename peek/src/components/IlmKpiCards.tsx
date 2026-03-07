import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

import { OverviewInfoCard } from "./OverviewInfoCard";

const PHASE_COLORS: Record<string, "info" | "success" | "warning" | "error" | "default"> = {
  hot: "error",
  warm: "warning",
  cold: "info",
  frozen: "info",
  delete: "default",
};

interface IlmKpiCardsProps {
  indexCount: number;
  errorCount: number;
  policyCount: number;
  phaseDistribution: Record<string, number>;
}

export default function IlmKpiCards({
  indexCount,
  errorCount,
  policyCount,
  phaseDistribution,
}: IlmKpiCardsProps) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Managed Indices">
          <Typography variant="h5" component="p">
            {indexCount}
          </Typography>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Indices in ERROR">
          <Typography variant="h5" component="p" color={errorCount > 0 ? "error" : undefined}>
            {errorCount}
          </Typography>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Policies">
          <Typography variant="h5" component="p">
            {policyCount}
          </Typography>
        </OverviewInfoCard>
      </Grid>
      <Grid item xs={6} sm={3}>
        <OverviewInfoCard title="Phase Distribution">
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {Object.entries(phaseDistribution).map(([phase, count]) => (
              <Chip
                key={phase}
                label={`${phase}: ${count}`}
                size="small"
                color={PHASE_COLORS[phase] ?? "default"}
                variant="outlined"
              />
            ))}
            {Object.keys(phaseDistribution).length === 0 && (
              <Typography variant="body2" color="text.secondary">
                {"\u2014"}
              </Typography>
            )}
          </Box>
        </OverviewInfoCard>
      </Grid>
    </Grid>
  );
}
