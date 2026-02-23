import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import {
  aggregateFleetPolicies,
  fleetStatusColor,
  loadFleetAgents,
  type FleetAgentSummary,
  type FleetPolicySummary,
} from "../services/fleet";
import { useDashboardStore } from "../store/useDashboardStore";

interface FleetDataState {
  agents: FleetAgentSummary[];
  total: number;
  policies: FleetPolicySummary[];
}

export default function FleetPage() {
  const connection = useDashboardStore((s) => s.connection);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FleetDataState>({ agents: [], total: 0, policies: [] });

  const loadFleetData = useCallback(async () => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    try {
      const client = new ElasticsearchClient(connection);
      const fleetAgents = await loadFleetAgents(client);
      setData({
        agents: fleetAgents.agents,
        total: fleetAgents.total,
        policies: aggregateFleetPolicies(fleetAgents.agents),
      });
    } catch (err) {
      setError(isElasticsearchError(err) ? err.message : String(err));
      setData({ agents: [], total: 0, policies: [] });
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadFleetData();
  }, [loadFleetData]);

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const agent of data.agents) {
      const normalized = agent.status.trim().toLowerCase() || "unknown";
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data.agents]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minHeight: 0, height: "100%" }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" sx={{ flex: 1 }}>
            Fleet
          </Typography>
          <Button size="small" variant="outlined" onClick={loadFleetData} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : "Refresh"}
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip label={`Agents: ${data.total}`} size="small" color="primary" />
          <Chip label={`Policies: ${data.policies.length}`} size="small" />
          {statusCounts.map(([status, count]) => (
            <Chip
              key={status}
              size="small"
              color={fleetStatusColor(status)}
              label={`${status}: ${count}`}
            />
          ))}
        </Stack>
      </Paper>

      {loading && data.agents.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: "flex", gap: 1.5, minHeight: 0, flex: 1 }}>
          <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
            <Table stickyHeader size="small" aria-label="Fleet agents table">
              <TableHead>
                <TableRow>
                  <TableCell>Agent</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Policy</TableCell>
                  <TableCell>Last check-in</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.agents.map((agent) => (
                  <TableRow
                    hover
                    key={agent.id}
                    sx={{ cursor: "pointer" }}
                    onClick={() => navigate(`/fleet/agents/${encodeURIComponent(agent.id)}`)}
                  >
                    <TableCell>
                      <Stack>
                        <Typography variant="body2">{agent.hostname}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {agent.id}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={agent.status}
                        color={fleetStatusColor(agent.status)}
                      />
                    </TableCell>
                    <TableCell>{agent.policyId}</TableCell>
                    <TableCell>{agent.lastCheckin ?? "n/a"}</TableCell>
                  </TableRow>
                ))}
                {data.agents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography variant="body2" color="text.secondary">
                        No Fleet agent documents found in .fleet-agents* or fleet-agents*.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
            <Table stickyHeader size="small" aria-label="Fleet policies table">
              <TableHead>
                <TableRow>
                  <TableCell>Policy</TableCell>
                  <TableCell align="right">Agents</TableCell>
                  <TableCell align="right">Online</TableCell>
                  <TableCell align="right">Degraded</TableCell>
                  <TableCell align="right">Errors</TableCell>
                  <TableCell align="right">Inactive</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.policies.map((policy) => (
                  <TableRow key={policy.policyId}>
                    <TableCell>{policy.policyId}</TableCell>
                    <TableCell align="right">{policy.agents}</TableCell>
                    <TableCell align="right">{policy.onlineAgents}</TableCell>
                    <TableCell align="right">{policy.degradedAgents}</TableCell>
                    <TableCell align="right">{policy.errorAgents}</TableCell>
                    <TableCell align="right">{policy.inactiveAgents}</TableCell>
                  </TableRow>
                ))}
                {data.policies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">
                        Policy summary appears when Fleet agents are available.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}
