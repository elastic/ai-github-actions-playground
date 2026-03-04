import Alert from "@mui/material/Alert";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { PAGE_MANIFEST } from "../../routes/manifest";
import type { KubernetesActiveTab } from "../../types/pageFilters";
import DateRangePicker from "../DateRangePicker";
import EmptyState from "../EmptyState";
import PageHeader from "../PageHeader";
import { toDashboardTimeRange, toTraceTimeRange } from "../timePresets";

import K8sInsightsPanel from "./K8sInsightsPanel";
import K8sInventoryTable from "./K8sInventoryTable";
import K8sOverviewCards from "./K8sOverviewCards";
import { useK8sInventorySearch } from "./useK8sInventorySearch";

const TAB_OPTIONS: { value: KubernetesActiveTab; label: string; singularLabel: string }[] = [
  { value: "clusters", label: "Clusters", singularLabel: "cluster" },
  { value: "namespaces", label: "Namespaces", singularLabel: "namespace" },
  { value: "workloads", label: "Workloads", singularLabel: "workload" },
  { value: "pods", label: "Pods", singularLabel: "pod" },
];

export default function KubernetesPage() {
  const {
    filters,
    updateFilters,
    searchResult,
    clusterRows,
    namespaceRows,
    workloadRows,
    podRows,
    sortField,
    sortDirection,
    loading,
    error,
    handleSort,
    handleSearch,
    handleReset,
    handleTabChange,
    cancelSearch,
  } = useK8sInventorySearch();

  const activeRows = (() => {
    switch (filters.activeTab) {
      case "clusters":
        return clusterRows;
      case "namespaces":
        return namespaceRows;
      case "workloads":
        return workloadRows;
      case "pods":
        return podRows;
    }
  })();

  const tabLabel = TAB_OPTIONS.find((t) => t.value === filters.activeTab)?.label ?? "";
  const tabSingularLabel =
    TAB_OPTIONS.find((t) => t.value === filters.activeTab)?.singularLabel ?? "";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minHeight: "100%" }}>
      <PageHeader
        title="Kubernetes"
        description="Inventory and health overview of your Kubernetes clusters, namespaces, workloads, and pods."
      />
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <DateRangePicker
            value={toDashboardTimeRange({ from: filters.timeFrom, to: filters.timeTo })}
            onChange={(range) => {
              const traceRange = toTraceTimeRange(range);
              cancelSearch();
              updateFilters({ timeFrom: traceRange.from, timeTo: traceRange.to });
            }}
          />
          <TextField
            size="small"
            label="Cluster"
            placeholder="All clusters"
            value={filters.cluster ?? ""}
            onChange={(e) => updateFilters({ cluster: e.target.value || null })}
            sx={{ minWidth: 160 }}
          />
          <Button variant="contained" size="small" onClick={handleSearch} disabled={loading}>
            {loading ? <CircularProgress size={14} color="inherit" /> : "Search"}
          </Button>
          <Button variant="text" size="small" onClick={handleReset} disabled={loading}>
            Reset
          </Button>
          {searchResult && (
            <Typography variant="body2" color="text.secondary">
              {activeRows.length}{" "}
              {activeRows.length === 1 ? tabSingularLabel : tabLabel.toLowerCase()} found
            </Typography>
          )}
        </Box>
      </Paper>

      <Paper variant="outlined">
        <Tabs
          value={filters.activeTab}
          onChange={(_, v: KubernetesActiveTab) => handleTabChange(v)}
          aria-label="Kubernetes inventory tabs"
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          {TAB_OPTIONS.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </Tabs>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !searchResult && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            icon={<SearchOffIcon />}
            heading="No Kubernetes data loaded"
            description="Click Search to discover Kubernetes resources from your metrics data."
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}

      {!loading && searchResult && activeRows.length === 0 && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 200, overflow: "auto" }}>
          <EmptyState
            heading={`No ${tabLabel.toLowerCase()} found`}
            description="No resources were found in the selected time range. Try expanding the time range or check your data ingestion."
            addDataHref={PAGE_MANIFEST.addData.path}
          />
        </Paper>
      )}

      {activeRows.length > 0 && (
        <Stack spacing={2}>
          <K8sInsightsPanel
            clusterRows={clusterRows}
            namespaceRows={namespaceRows}
            workloadRows={workloadRows}
            podRows={podRows}
          />
          <K8sOverviewCards
            clusterRows={clusterRows}
            namespaceRows={namespaceRows}
            workloadRows={workloadRows}
            podRows={podRows}
          />
          <Paper variant="outlined" sx={{ overflow: "auto" }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {tabLabel}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Detailed inventory of discovered {tabLabel.toLowerCase()}
              </Typography>
            </Box>
            <K8sInventoryTable
              activeTab={filters.activeTab}
              clusterRows={clusterRows}
              namespaceRows={namespaceRows}
              workloadRows={workloadRows}
              podRows={podRows}
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
