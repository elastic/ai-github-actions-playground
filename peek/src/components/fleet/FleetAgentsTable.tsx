import { memo, useMemo, type KeyboardEvent } from "react";
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
import DevicesIcon from "@mui/icons-material/Devices";

import type { ElasticAgentInfo } from "../../services/fleet";
import { computeCheckinStaleness } from "../../services/fleet";
import { usePageFiltersStore } from "../../store/usePageFiltersStore";
import EmptyState from "../EmptyState";

import { stalenessSeverityToColor } from "./fleetPresentation";

interface Props {
  agents: ElasticAgentInfo[];
  onAgentClick: (agentId: string) => void;
}

export default memo(function FleetAgentsTable({ agents, onAgentClick }: Props) {
  const agentFilter = usePageFiltersStore((s) => s.agentFilter);
  const updateAgentFilter = usePageFiltersStore((s) => s.updateAgentFilter);
  const resetFilters = usePageFiltersStore((s) => s.resetFleetFilters);

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
    if (agentFilter.hasErrors) {
      result = result.filter((a) => a.errorCount > 0);
    }
    if (agentFilter.staleness) {
      result = result.filter(
        (a) => computeCheckinStaleness(a.lastSeen).severity === agentFilter.staleness,
      );
    }
    return result;
  }, [agents, agentFilter]);

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, agentId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onAgentClick(agentId);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%" }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          label="Search agents"
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
        {agentFilter.hasErrors && (
          <Chip
            size="small"
            label="Has errors"
            color="error"
            onDelete={() => updateAgentFilter({ hasErrors: false })}
          />
        )}
        {agentFilter.staleness && (
          <Chip
            size="small"
            label={agentFilter.staleness === "critical" ? "Offline" : "Stale"}
            color={stalenessSeverityToColor(agentFilter.staleness)}
            onDelete={() => updateAgentFilter({ staleness: null })}
          />
        )}
        {(agentFilter.hasErrors || agentFilter.staleness !== null) && (
          <Chip size="small" label="Clear filters" variant="outlined" onClick={resetFilters} />
        )}
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
                  tabIndex={0}
                  onClick={() => onAgentClick(agent.agentId)}
                  onKeyDown={(event) => handleRowKeyDown(event, agent.agentId)}
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
                      sx={{ color: `${stalenessSeverityToColor(staleness.severity)}.main` }}
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
                  <EmptyState
                    size="small"
                    icon={<DevicesIcon sx={{ fontSize: 28 }} />}
                    heading="No agents found"
                    description="No agents found in logs-elastic_agent-* for the last hour. Enroll Elastic Agent on your hosts to start collecting data."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
});
