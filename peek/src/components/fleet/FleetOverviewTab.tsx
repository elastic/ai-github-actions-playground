import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DevicesIcon from "@mui/icons-material/Devices";

import type { FleetServerStatusMetrics, FleetAgentVersionCount } from "../../services/fleet";
import type { AgentFilter } from "../../store/useFleetStore";
import EmptyState from "../EmptyState";

import FleetStatCard from "./FleetStatCard";
import FleetStatusChart from "./FleetStatusChart";
import FleetVersionChart from "./FleetVersionChart";

interface Props {
  serverStatus: FleetServerStatusMetrics | null;
  agentVersions: FleetAgentVersionCount[];
  agentInventoryTotal: number;
  agentInventoryTotalErrorCount: number;
  onDrillIn: (updates: Partial<AgentFilter>) => void;
}

export default function FleetOverviewTab({
  serverStatus,
  agentVersions,
  agentInventoryTotal,
  agentInventoryTotalErrorCount,
  onDrillIn,
}: Props) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {/* Stat cards */}
      {serverStatus ? (
        <>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <FleetStatCard title="Total" value={serverStatus.total} />
            <FleetStatCard title="Healthy" value={serverStatus.healthy} color="success.main" />
            <FleetStatCard
              title="Unhealthy"
              value={serverStatus.unhealthy}
              color="warning.main"
              onClick={
                serverStatus.unhealthy > 0 ? () => onDrillIn({ hasErrors: true }) : undefined
              }
            />
            <FleetStatCard
              title="Offline"
              value={serverStatus.offline}
              color="text.secondary"
              onClick={
                serverStatus.offline > 0 ? () => onDrillIn({ staleness: "critical" }) : undefined
              }
            />
            <FleetStatCard title="Updating" value={serverStatus.updating} color="info.main" />
            <FleetStatCard title="Inactive" value={serverStatus.inactive} />
          </Stack>

          {/* Unhealthy reason breakdown */}
          {serverStatus.unhealthy > 0 && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Unhealthy reasons:
              </Typography>
              {serverStatus.unhealthyReason.input > 0 && (
                <Chip
                  size="small"
                  label={`Input: ${serverStatus.unhealthyReason.input}`}
                  color="warning"
                  variant="outlined"
                />
              )}
              {serverStatus.unhealthyReason.output > 0 && (
                <Chip
                  size="small"
                  label={`Output: ${serverStatus.unhealthyReason.output}`}
                  color="warning"
                  variant="outlined"
                />
              )}
              {serverStatus.unhealthyReason.other > 0 && (
                <Chip
                  size="small"
                  label={`Other: ${serverStatus.unhealthyReason.other}`}
                  color="warning"
                  variant="outlined"
                />
              )}
            </Stack>
          )}

          {/* Charts */}
          <Box sx={{ display: "flex", gap: 1.5, minHeight: 250 }}>
            <Paper variant="outlined" sx={{ flex: 1, p: 1.5 }}>
              <Typography variant="body2" gutterBottom>
                Agent Status
              </Typography>
              <Box sx={{ height: 200 }}>
                <FleetStatusChart status={serverStatus} />
              </Box>
            </Paper>
            <Paper variant="outlined" sx={{ flex: 1, p: 1.5 }}>
              <Typography variant="body2" gutterBottom>
                Version Distribution
              </Typography>
              <Box sx={{ height: 200 }}>
                <FleetVersionChart versions={agentVersions} />
              </Box>
            </Paper>
          </Box>

          {/* Enrolled/Unenrolled */}
          <Stack direction="row" spacing={1}>
            <Chip size="small" label={`Enrolled: ${serverStatus.enrolled}`} variant="outlined" />
            <Chip
              size="small"
              label={`Unenrolled: ${serverStatus.unenrolled}`}
              variant="outlined"
            />
          </Stack>
        </>
      ) : (
        <EmptyState
          icon={<DevicesIcon sx={{ fontSize: 32 }} />}
          heading="No Fleet Server status available"
          description={
            agentInventoryTotal > 0
              ? `${agentInventoryTotal} agent${agentInventoryTotal !== 1 ? "s" : ""} found via Elastic Agent logs; switch to the Agents tab to view them.`
              : "No Fleet Server status metrics found in metrics-fleet_server.agent_status-*."
          }
        />
      )}

      {/* Quick agent summary when no server status but agents exist */}
      {!serverStatus && agentInventoryTotal > 0 && (
        <>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <FleetStatCard title="Agents (from logs)" value={agentInventoryTotal} />
            <FleetStatCard
              title="With Errors"
              value={agentInventoryTotalErrorCount}
              color="error.main"
              onClick={
                agentInventoryTotalErrorCount > 0 ? () => onDrillIn({ hasErrors: true }) : undefined
              }
            />
          </Stack>
          {agentVersions.length > 0 && (
            <Paper variant="outlined" sx={{ height: 200, p: 1.5 }}>
              <Typography variant="body2" gutterBottom>
                Version Distribution
              </Typography>
              <Box sx={{ height: 160 }}>
                <FleetVersionChart versions={agentVersions} />
              </Box>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
