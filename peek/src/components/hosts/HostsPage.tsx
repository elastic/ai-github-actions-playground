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
import EmptyState from "../EmptyState";
import PageHeader from "../PageHeader";

import HostInventoryTable from "./HostInventoryTable";
import HostOverviewCards from "./HostOverviewCards";
import { useHostsInventorySearch } from "./useHostsInventorySearch";
import type { HostOsType } from "./hostTypes";
import { osLabel } from "./hostTypes";

interface HostsPageProps {
  /** When set, restricts the page to a single OS type. */
  osType?: HostOsType;
}

export default function HostsPage({ osType }: HostsPageProps) {
  const {
    filters,
    updateFilters,
    searchResult,
    hostRows,
    sortField,
    sortDirection,
    loading,
    error,
    handleSort,
    handleSearch,
    handleReset,
    cancelSearch,
  } = useHostsInventorySearch(osType);

  const title = osType ? `${osLabel(osType)} Hosts` : "Hosts";
  const description = osType
    ? `Inventory and health snapshot of your ${osLabel(osType)} hosts.`
    : "Inventory and health snapshot of all monitored hosts.";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: "100%" }}>
      <PageHeader title={title} description={description} />
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <TextField
            size="small"
            label="Search hosts"
            placeholder="Filter by host name"
            value={filters.search}
            onChange={(e) => {
              cancelSearch();
              updateFilters({ search: e.target.value });
            }}
            sx={{ minWidth: 200 }}
          />
          <Button variant="contained" onClick={handleSearch} disabled={loading}>
            {loading ? <CircularProgress size={14} color="inherit" /> : "Search"}
          </Button>
          <Button variant="text" onClick={handleReset} disabled={loading}>
            Reset
          </Button>
          {searchResult && (
            <Typography variant="body2" color="text.secondary">
              {hostRows.length} {hostRows.length === 1 ? "host" : "hosts"} found
            </Typography>
          )}
        </Box>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !searchResult && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            icon={<SearchOffIcon />}
            heading="No host data loaded"
            description="Click Search to discover hosts from your host metrics data."
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}

      {!loading && searchResult && hostRows.length === 0 && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            heading="No hosts found"
            description="No hosts were found in the selected time range. Try expanding the time range or check your data ingestion."
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}

      {hostRows.length > 0 && (
        <Stack spacing={2}>
          <HostOverviewCards hostRows={hostRows} />
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
