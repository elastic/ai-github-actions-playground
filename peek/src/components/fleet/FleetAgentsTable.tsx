import { memo, useCallback, useMemo, useState, type KeyboardEvent } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import DevicesIcon from "@mui/icons-material/Devices";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";

import type { ElasticAgentInfo } from "../../services/fleet";
import { computeCheckinStaleness, fleetStatusColor } from "../../services/fleet";
import { usePageFiltersStore } from "../../store/usePageFiltersStore";
import EmptyState from "../EmptyState";
import { compareSemver } from "../../utils/compareSemver";

import { stalenessSeverityToColor } from "./fleetPresentation";

interface Props {
  agents: ElasticAgentInfo[];
  onAgentClick: (agentId: string) => void;
}

type SortField =
  | "hostname"
  | "status"
  | "version"
  | "policyId"
  | "os"
  | "lastSeen"
  | "logCount"
  | "errorCount";
type SortDirection = "asc" | "desc";

export default memo(function FleetAgentsTable({ agents, onAgentClick }: Props) {
  const agentFilter = usePageFiltersStore((s) => s.agentFilter);
  const updateAgentFilter = usePageFiltersStore((s) => s.updateAgentFilter);
  const resetFilters = usePageFiltersStore((s) => s.resetFleetAgentFilter);

  const [sortField, setSortField] = useState<SortField>("hostname");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDirection("asc");
      }
    },
    [sortField],
  );

  const uniqueVersions = useMemo(() => {
    const versions = new Set(agents.map((a) => a.version));
    return [...versions].sort(compareSemver);
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
    return [...result].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortField) {
        case "hostname":
          aVal = a.hostname;
          bVal = b.hostname;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "version": {
          const cmp = compareSemver(a.version, b.version);
          return sortDirection === "asc" ? cmp : -cmp;
        }
        case "policyId":
          aVal = a.policyId;
          bVal = b.policyId;
          break;
        case "os":
          aVal = a.os?.name ?? "";
          bVal = b.os?.name ?? "";
          break;
        case "lastSeen":
          aVal = a.lastSeen;
          bVal = b.lastSeen;
          break;
        case "logCount":
          aVal = a.logCount;
          bVal = b.logCount;
          break;
        case "errorCount":
          aVal = a.errorCount;
          bVal = b.errorCount;
          break;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [agents, agentFilter, sortField, sortDirection]);

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
              <TableCell>
                <TableSortLabel
                  active={sortField === "hostname"}
                  direction={sortField === "hostname" ? sortDirection : "asc"}
                  onClick={() => handleSort("hostname")}
                >
                  Agent
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "status"}
                  direction={sortField === "status" ? sortDirection : "asc"}
                  onClick={() => handleSort("status")}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "version"}
                  direction={sortField === "version" ? sortDirection : "asc"}
                  onClick={() => handleSort("version")}
                >
                  Version
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "policyId"}
                  direction={sortField === "policyId" ? sortDirection : "asc"}
                  onClick={() => handleSort("policyId")}
                >
                  Policy
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "os"}
                  direction={sortField === "os" ? sortDirection : "asc"}
                  onClick={() => handleSort("os")}
                >
                  OS
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "lastSeen"}
                  direction={sortField === "lastSeen" ? sortDirection : "asc"}
                  onClick={() => handleSort("lastSeen")}
                >
                  Last Seen
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortField === "logCount"}
                  direction={sortField === "logCount" ? sortDirection : "asc"}
                  onClick={() => handleSort("logCount")}
                >
                  Logs
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortField === "errorCount"}
                  direction={sortField === "errorCount" ? sortDirection : "asc"}
                  onClick={() => handleSort("errorCount")}
                >
                  Errors
                </TableSortLabel>
              </TableCell>
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
                  <TableCell>
                    <Chip
                      size="small"
                      label={agent.status}
                      color={fleetStatusColor(agent.status)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{agent.version}</TableCell>
                  <TableCell>{agent.policyId}</TableCell>
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
            {filtered.length === 0 && agents.length > 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    size="small"
                    icon={<FilterListOffIcon sx={{ fontSize: 28 }} />}
                    heading="No agents match current filters"
                    description="Try adjusting your search or filters to find what you're looking for."
                    action={
                      <Button variant="outlined" size="small" onClick={resetFilters}>
                        Clear filters
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {filtered.length === 0 && agents.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
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
