import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { ElasticsearchClient, isElasticsearchError } from "../services/es";
import { fleetStatusColor, loadFleetAgents, type FleetAgentSummary } from "../services/fleet";
import { useDashboardStore } from "../store/useDashboardStore";

export default function FleetAgentPage() {
  const connection = useDashboardStore((s) => s.connection);
  const navigate = useNavigate();
  const { agentId = "" } = useParams<{ agentId: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<FleetAgentSummary[]>([]);
  const decodedAgentId = decodeURIComponent(agentId);

  const loadFleetData = useCallback(async () => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    try {
      const client = new ElasticsearchClient(connection);
      const result = await loadFleetAgents(client);
      setAgents(result.agents);
    } catch (err) {
      setError(isElasticsearchError(err) ? err.message : String(err));
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void loadFleetData();
  }, [loadFleetData]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === decodedAgentId) ?? null,
    [agents, decodedAgentId],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" variant="text" onClick={() => navigate("/fleet")}>
            Back to Fleet
          </Button>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Fleet Agent
          </Typography>
          <Button size="small" variant="outlined" onClick={loadFleetData} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : "Refresh"}
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && !selectedAgent ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : !selectedAgent ? (
        <Alert severity="warning">Agent {decodedAgentId} was not found in Fleet documents.</Alert>
      ) : (
        <Stack spacing={1.5}>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1}>
              <Typography variant="h6">{selectedAgent.hostname}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={selectedAgent.id} />
                <Chip
                  size="small"
                  label={`Status: ${selectedAgent.status}`}
                  color={fleetStatusColor(selectedAgent.status)}
                />
                <Chip size="small" label={`Policy: ${selectedAgent.policyId}`} />
                {selectedAgent.policyRevision !== null && (
                  <Chip size="small" label={`Policy rev: ${selectedAgent.policyRevision}`} />
                )}
                <Chip
                  size="small"
                  label={`Active: ${selectedAgent.active === null ? "unknown" : selectedAgent.active ? "yes" : "no"}`}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Last check-in: {selectedAgent.lastCheckin ?? "n/a"}
              </Typography>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle1" gutterBottom>
              Policy and configuration
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1,
                borderRadius: 1,
                bgcolor: "background.default",
                overflowX: "auto",
                fontSize: "0.75rem",
              }}
            >
              {JSON.stringify(selectedAgent.source, null, 2)}
            </Box>
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
