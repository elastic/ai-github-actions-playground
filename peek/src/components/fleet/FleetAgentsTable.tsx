import { useMemo } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";

import type { ElasticAgentInfo } from "../../services/fleet";
import { computeCheckinStaleness } from "../../services/fleet";
import { useFleetStore } from "../../store/useFleetStore";

interface Props {
  agents: ElasticAgentInfo[];
  onAgentClick: (agentId: string) => void;
}

const STALENESS_COLORS: Record<string, string> = {
  fresh: "success.main",
  stale: "warning.main",
  critical: "error.main",
};

export default function FleetAgentsTable({ agents, onAgentClick }: Props) {
  const agentFilter = useFleetStore((s) => s.agentFilter);
  const updateAgentFilter = useFleetStore((s) => s.updateAgentFilter);

  const uniqueVersions = useMemo(() => {
    const versions = new Set(agents.map((a) => a.version));
    return [...versions].sort();
  }, [agents]);

  const filtered = useMemo(() => {
    let result = agents;
    if (agentFilter.search) {
      const q = agentFilter.search.toLowerCase();
      result = result.filter(
        (a) =>
          a.hostname.toLowerCase().includes(q) ||
          a.agentId.toLowerCase().includes(q) ||
          (a.os?.name ?? "").toLowerCase().includes(q),
      );
    }
    if (agentFilter.version) {
      result = result.filter((a) => a.version === agentFilter.version);
    }
    return result;
  }, [agents, agentFilter]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%" }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          placeholder="Search hostname or ID..."
          value={agentFilter.search}
          onChange={(e) => updateAgentFilter({ search: e.target.value })}
          sx={{ width: 240 }}
        />
        {uniqueVersions.map((v) => (
          <Chip
            key={v}
            size="small"
            label={v}
            variant={agentFilter.version === v ? "filled" : "outlined"}
            color={agentFilter.version === v ? "primary" : "default"}
            onClick={() => updateAgentFilter({ version: agentFilter.version === v ? null : v })}
          />
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
          {filtered.length} agent{filtered.length !== 1 ? "s" : ""}
        </Typography>
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
        <Table stickyHeader size="small" aria-label="Elastic Agent inventory">
          <TableHead>
            <TableRow>
              <TableCell>Agent</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>OS</TableCell>
              <TableCell>Last Seen</TableCell>
              <TableCell align="right">Logs</TableCell>
              <TableCell align="right">Errors</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((agent) => {
              const staleness = computeCheckinStaleness(agent.lastSeen);
              return (
                <TableRow
                  hover
                  key={agent.agentId}
                  sx={{ cursor: "pointer" }}
                  onClick={() => onAgentClick(agent.agentId)}
                >
                  <TableCell>
                    <Stack>
                      <Typography variant="body2">{agent.hostname}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {agent.agentId}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{agent.version}</TableCell>
                  <TableCell>{agent.os?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ color: STALENESS_COLORS[staleness.severity] }}
                    >
                      {staleness.label}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{agent.logCount}</TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={agent.errorCount > 0 ? "error.main" : "text.primary"}
                    >
                      {agent.errorCount}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    No agents found in logs-elastic_agent-* for the last hour.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
