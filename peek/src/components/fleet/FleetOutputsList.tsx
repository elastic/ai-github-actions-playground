import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { type FleetOutputHealth } from "../../services/fleet";

import { formatFleetTimestamp } from "./fleetPresentation";

interface Props {
  outputs: FleetOutputHealth[];
}

const STATE_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  HEALTHY: "success",
  DEGRADED: "warning",
  UNHEALTHY: "error",
};

export default function FleetOutputsList({ outputs }: Props) {
  if (outputs.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        No output health data found in logs-fleet_server.output_health-*.
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {outputs.map((o) => (
        <Paper key={o.output} variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              {o.output}
            </Typography>
            <Chip
              size="small"
              label={o.state}
              color={STATE_COLOR[o.state.toUpperCase()] ?? "default"}
            />
          </Stack>
          {o.message && (
            <Typography variant="body2" color="text.secondary">
              {o.message}
            </Typography>
          )}
          {o.timestamp && (
            <Typography variant="caption" color="text.secondary">
              {formatFleetTimestamp(o.timestamp)}
            </Typography>
          )}
        </Paper>
      ))}
    </Box>
  );
}
