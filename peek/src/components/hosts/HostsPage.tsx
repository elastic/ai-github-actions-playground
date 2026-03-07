import { useMemo } from "react";
import Alert from "@mui/material/Alert";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { PAGE_MANIFEST } from "../../routes/manifest";
import DateRangePicker from "../DateRangePicker";
import EmptyState from "../EmptyState";
import PageHeader from "../PageHeader";

import HostHoneycombChart from "./HostHoneycombChart";
import HostInventoryTable from "./HostInventoryTable";
import HostMetricsCharts from "./HostMetricsCharts";
import HostOverviewCards from "./HostOverviewCards";
import { useHostsInventorySearch } from "./useHostsInventorySearch";
import type { HostOsType } from "./hostTypes";
import { osLabel } from "./hostTypes";
import type { HostQueryFilters } from "./hostQueryBuilder";

interface HostsPageProps {
  /** When set, restricts the page to a single OS type. */
  osType?: HostOsType;
}

export default function HostsPage({ osType }: HostsPageProps) {
  const {
    filters,
    updateFilters,
    hostRows,
    sortField,
    sortDirection,
    loading,
    error,
    handleSort,
    handleReset,
  } = useHostsInventorySearch(osType);

  const title = osType ? `${osLabel(osType)} Hosts` : "Hosts";
  const description = osType
    ? `Inventory and health snapshot of your ${osLabel(osType)} hosts.`
    : "Inventory and health snapshot of all monitored hosts.";

  const metricsFilters = useMemo<HostQueryFilters>(
    () => ({
      timeFrom: filters.timeFrom,
      timeTo: filters.timeTo,
      osType: osType ?? (filters.osFilter === "all" ? undefined : filters.osFilter),
      search: filters.search || undefined,
    }),
    [filters, osType],
  );

  const hasData = hostRows.length > 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: "100%" }}>
      <PageHeader title={title} description={description} />

      {/* Toolbar */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <TextField
            size="small"
            label="Search hosts"
            placeholder="Filter by host name"
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            sx={{ minWidth: 200 }}
          />
          <DateRangePicker
            value={{ from: filters.timeFrom, to: filters.timeTo }}
            onChange={(range) => updateFilters({ timeFrom: range.from, timeTo: range.to })}
          />
          <Button variant="text" onClick={handleReset} disabled={loading}>
            Reset
          </Button>
          {loading && <CircularProgress size={16} />}
          {hasData && (
            <Typography variant="body2" color="text.secondary">
              {hostRows.length} {hostRows.length === 1 ? "host" : "hosts"} found
            </Typography>
          )}
        </Box>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !hasData && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            icon={<SearchOffIcon />}
            heading="No hosts found"
            description="No hosts were found in the selected time range. Try expanding the time range or check your data ingestion."
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}

      {hasData && (
        <Stack spacing={2}>
          {/* Overview stat cards */}
          <HostOverviewCards hostRows={hostRows} />

          {/* Hero: Honeycomb / treemap chart */}
          <HostHoneycombChart hostRows={hostRows} />

          {/* Time-series metric charts */}
          <HostMetricsCharts filters={metricsFilters} />

          {/* Inventory table */}
          <Paper variant="outlined" sx={{ overflow: "auto" }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Host Inventory
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Snapshot of discovered hosts and their resource utilization
              </Typography>
            </Box>
            <HostInventoryTable
              hostRows={hostRows}
              sortField={sortField}
              sortDirection={sortDirection}
              handleSort={handleSort}
            />
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
