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
          <Typography variant="h6">{total}</Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ minWidth: 150 }}>
        <OverviewInfoCard title="Running">
          <Typography variant="h6">
            {running}
            {running > 0 && <Chip label={running} color="success" size="small" sx={{ ml: 1 }} />}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ minWidth: 150 }}>
        <OverviewInfoCard title="Failed">
          <Typography variant="h6">
            {failed}
            {failed > 0 && <Chip label={failed} color="error" size="small" sx={{ ml: 1 }} />}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ minWidth: 150 }}>
        <OverviewInfoCard title="Stopped">
          <Typography variant="h6">
            {stopped}
            {stopped > 0 && <Chip label={stopped} size="small" sx={{ ml: 1 }} />}
          </Typography>
        </OverviewInfoCard>
      </Box>
      <Box sx={{ minWidth: 170 }}>
        <OverviewInfoCard title="Health Issues">
          <Typography variant="h6">
            {healthIssues}
            {healthIssues > 0 && (
              <Chip label={healthIssues} color="warning" size="small" sx={{ ml: 1 }} />
            )}
          </Typography>
        </OverviewInfoCard>
      </Box>
    </Stack>
  );
}
