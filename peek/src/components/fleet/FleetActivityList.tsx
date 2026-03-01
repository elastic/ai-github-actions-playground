import { useMemo } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { type FleetAction, type FleetActionResult } from "../../services/fleet";
import EmptyState from "../EmptyState";

import { formatFleetTimestamp } from "./fleetPresentation";

interface Props {
  actions: FleetAction[];
  actionResults: FleetActionResult[];
}

const TYPE_COLOR: Record<string, "primary" | "secondary" | "warning" | "info" | "default"> = {
  POLICY_CHANGE: "primary",
  UNENROLL: "warning",
  UPGRADE: "info",
  INPUT_ACTION: "secondary",
};

export default function FleetActivityList({ actions, actionResults }: Props) {
  const resultsByAction = useMemo(() => {
    const map = new Map<string, FleetActionResult[]>();
    for (const r of actionResults) {
      const existing = map.get(r.actionId) ?? [];
      existing.push(r);
      map.set(r.actionId, existing);
    }
    return map;
  }, [actionResults]);

  if (actions.length === 0) {
    return (
      <EmptyState
        size="small"
        heading="No fleet actions"
        description="No actions found in fleet-actions*."
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {actions.map((action) => {
        const results = resultsByAction.get(action.id) ?? [];
        const errorResults = results.filter((r) => r.error);
        const completedCount = results.length;
        const targetCount = action.agents.length;

        return (
          <Paper key={action.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Chip
                size="small"
                label={action.type}
                color={TYPE_COLOR[action.type.toUpperCase()] ?? "default"}
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                {formatFleetTimestamp(action.createdAt)}
              </Typography>
              {targetCount > 0 && (
                <Chip
                  size="small"
                  label={`${completedCount}/${targetCount} agents`}
                  color={completedCount >= targetCount ? "success" : "default"}
                  variant="outlined"
                />
              )}
            </Stack>

            <Typography variant="caption" color="text.secondary" noWrap>
              {action.id}
            </Typography>

            {errorResults.length > 0 && (
              <Box sx={{ mt: 0.5 }}>
                {errorResults.map((r) => (
                  <Typography
                    key={`${r.actionId}-${r.agentId}`}
                    variant="caption"
                    color="error.main"
                    component="div"
                  >
                    Agent {r.agentId.slice(0, 8)}...: {r.error}
                  </Typography>
                ))}
              </Box>
            )}

            {action.expiration && (
              <Typography variant="caption" color="text.secondary" component="div">
                Expires: {formatFleetTimestamp(action.expiration)}
              </Typography>
            )}
          </Paper>
        );
      })}
    </Box>
  );
}
