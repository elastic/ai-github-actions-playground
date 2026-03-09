import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { OverviewInfoCard } from "../OverviewInfoCard";

interface TransformKpiCardsProps {
  total: number;
  running: number;
  failed: number;
  stopped: number;
  healthIssues: number;
}

export function TransformKpiCards({
  total,
  running,
  failed,
  stopped,
  healthIssues,
}: TransformKpiCardsProps) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Box sx={{ minWidth: 150 }}>
        <OverviewInfoCard title="Total Transforms">
          <Typography variant="h3" component="div">
            {total}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ minWidth: 150 }}>
        <OverviewInfoCard title="Running">
          <Typography variant="h3" component="div">
            {running > 0 ? <Chip label={running} color="success" size="small" /> : running}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ minWidth: 150 }}>
        <OverviewInfoCard title="Failed">
          <Typography variant="h3" component="div">
            {failed > 0 ? <Chip label={failed} color="error" size="small" /> : failed}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ minWidth: 150 }}>
        <OverviewInfoCard title="Stopped">
          <Typography variant="h3" component="div">
            {stopped > 0 ? <Chip label={stopped} size="small" /> : stopped}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ minWidth: 170 }}>
        <OverviewInfoCard title="Health Issues">
          <Typography variant="h3" component="div">
            {healthIssues > 0 ? (
              <Chip label={healthIssues} color="warning" size="small" />
            ) : (
              healthIssues
            )}
          </Typography>
        </OverviewInfoCard>
      </Box>
    </Stack>
  );
}
