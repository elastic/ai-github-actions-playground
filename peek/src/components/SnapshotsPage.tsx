import { useCallback, useDeferredValue, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

import { useSnapshotData } from "../hooks/useSnapshotData";
import { COMPONENT_HEIGHTS } from "../types/tokens";

import DataFetchAlert from "./DataFetchAlert";
import PageHeader from "./PageHeader";
import PoliciesTable from "./snapshots/PoliciesTable";
import RepositoriesTable from "./snapshots/RepositoriesTable";
import { SnapshotKpiCards, PolicyKpiCards } from "./snapshots/SnapshotKpiCards";
import SnapshotsTable from "./snapshots/SnapshotsTable";
import ToolbarRow from "./ToolbarRow";
import {
  compareSnapshots,
  comparePolicies,
  compareRepositories,
  type SnapshotSortField,
  type PolicySortField,
  type RepositorySortField,
  type SortDirection,
} from "./snapshotSortUtils";

const SNAPSHOT_TABS: Array<"snapshots" | "policies" | "repositories"> = [
  "snapshots",
  "policies",
  "repositories",
];
const SNAPSHOT_SORT_FIELDS: SnapshotSortField[] = [
  "state",
  "name",
  "repository",
  "indexCount",
  "startTime",
  "duration",
];
const POLICY_SORT_FIELDS: PolicySortField[] = [
  "name",
  "repository",
  "nextRun",
  "taken",
  "failed",
  "lastSuccess",
  "lastFailure",
];
const REPO_SORT_FIELDS: RepositorySortField[] = ["name", "type"];
const SORT_DIRECTIONS: SortDirection[] = ["asc", "desc"];

export default function SnapshotsPage() {
  const result = useSnapshotData();
  const loading = result.status === "loading";
  const data = result.status === "success" ? result.data : null;

  const snapshots = useMemo(() => data?.snapshots ?? [], [data]);
  const policies = useMemo(() => data?.policies ?? [], [data]);
  const repositories = useMemo(() => data?.repositories ?? [], [data]);
  const slmStats = data?.slmStats ?? null;

  const [urlState, setUrlState] = useQueryStates(
    {
      tab: parseAsStringEnum<"snapshots" | "policies" | "repositories">(SNAPSHOT_TABS).withDefault(
        "snapshots",
      ),
      q: parseAsString.withDefault(""),
      snapSort: parseAsStringEnum<SnapshotSortField>(SNAPSHOT_SORT_FIELDS).withDefault("startTime"),
      snapDir: parseAsStringEnum<SortDirection>(SORT_DIRECTIONS).withDefault("desc"),
      polSort: parseAsStringEnum<PolicySortField>(POLICY_SORT_FIELDS).withDefault("name"),
      polDir: parseAsStringEnum<SortDirection>(SORT_DIRECTIONS).withDefault("asc"),
      repoSort: parseAsStringEnum<RepositorySortField>(REPO_SORT_FIELDS).withDefault("name"),
      repoDir: parseAsStringEnum<SortDirection>(SORT_DIRECTIONS).withDefault("asc"),
    },
    { history: "replace" },
  );

  const {
    tab: activeTab,
    q: search,
    snapSort,
    snapDir,
    polSort,
    polDir,
    repoSort,
    repoDir,
  } = urlState;
  const deferredSearch = useDeferredValue(search);

  const handleSnapSort = useCallback(
    (field: SnapshotSortField) => {
      void setUrlState({
        snapSort: field,
        snapDir: snapSort === field && snapDir === "asc" ? "desc" : "asc",
      });
    },
    [snapSort, snapDir, setUrlState],
  );
  const handlePolSort = useCallback(
    (field: PolicySortField) => {
      void setUrlState({
        polSort: field,
        polDir: polSort === field && polDir === "asc" ? "desc" : "asc",
      });
    },
    [polSort, polDir, setUrlState],
  );
  const handleRepoSort = useCallback(
    (field: RepositorySortField) => {
      void setUrlState({
        repoSort: field,
        repoDir: repoSort === field && repoDir === "asc" ? "desc" : "asc",
      });
    },
    [repoSort, repoDir, setUrlState],
  );

  const filteredSnapshots = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return [...snapshots]
      .filter(
        (s) =>
          !term ||
          s.name.toLowerCase().includes(term) ||
          s.repository.toLowerCase().includes(term) ||
          s.state.toLowerCase().includes(term),
      )
      .sort((a, b) => compareSnapshots(a, b, snapSort, snapDir));
  }, [snapshots, deferredSearch, snapSort, snapDir]);

  const filteredPolicies = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return [...policies]
      .filter(
        (p) =>
          !term || p.name.toLowerCase().includes(term) || p.repository.toLowerCase().includes(term),
      )
      .sort((a, b) => comparePolicies(a, b, polSort, polDir));
  }, [policies, deferredSearch, polSort, polDir]);

  const filteredRepos = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return [...repositories]
      .filter(
        (r) => !term || r.name.toLowerCase().includes(term) || r.type.toLowerCase().includes(term),
      )
      .sort((a, b) => compareRepositories(a, b, repoSort, repoDir));
  }, [repositories, deferredSearch, repoSort, repoDir]);

  const successCount = useMemo(
    () => snapshots.filter((s) => s.state === "SUCCESS").length,
    [snapshots],
  );
  const failedCount = useMemo(
    () => snapshots.filter((s) => s.state === "FAILED" || s.state === "PARTIAL").length,
    [snapshots],
  );
  const inProgressCount = useMemo(
    () => snapshots.filter((s) => s.state === "IN_PROGRESS").length,
    [snapshots],
  );

  const filterLabel =
    activeTab === "snapshots"
      ? "Filter snapshots"
      : activeTab === "policies"
        ? "Filter policies"
        : "Filter repositories";

  if (result.status === "error") {
    return <DataFetchAlert result={result} onRetry={result.refresh} />;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Snapshots & SLM"
          actions={
            <Button
              size="small"
              variant="outlined"
              onClick={result.refresh}
              aria-label={loading ? "Refreshing snapshot data" : "Refresh snapshot data"}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        />
      </Paper>

      {activeTab === "snapshots" && (
        <SnapshotKpiCards
          total={snapshots.length}
          successCount={successCount}
          failedCount={failedCount}
          inProgressCount={inProgressCount}
        />
      )}
      {activeTab === "policies" && (
        <PolicyKpiCards
          policyCount={policies.length}
          totalTaken={slmStats?.total_snapshots_taken ?? 0}
          totalFailed={slmStats?.total_snapshots_failed ?? 0}
          retentionRuns={slmStats?.retention_runs ?? 0}
        />
      )}

      <ToolbarRow>
        <Tabs
          value={activeTab}
          onChange={(_, v) =>
            void setUrlState({ tab: v as "snapshots" | "policies" | "repositories" })
          }
          sx={{ minHeight: COMPONENT_HEIGHTS.tab }}
        >
          <Tab
            label="Snapshots"
            value="snapshots"
            sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }}
          />
          <Tab
            label="SLM Policies"
            value="policies"
            sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }}
          />
          <Tab
            label="Repositories"
            value="repositories"
            sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }}
          />
        </Tabs>
        <TextField
          size="small"
          placeholder="Filter..."
          value={search}
          onChange={(e) => void setUrlState({ q: e.target.value })}
          sx={{ minWidth: 260 }}
          aria-label={filterLabel}
        />
      </ToolbarRow>

      {activeTab === "snapshots" && (
        <SnapshotsTable
          loading={loading}
          rows={filteredSnapshots}
          totalCount={snapshots.length}
          sortField={snapSort}
          sortDir={snapDir}
          onSort={handleSnapSort}
        />
      )}
      {activeTab === "policies" && (
        <PoliciesTable
          loading={loading}
          rows={filteredPolicies}
          totalCount={policies.length}
          sortField={polSort}
          sortDir={polDir}
          onSort={handlePolSort}
        />
      )}
      {activeTab === "repositories" && (
        <RepositoriesTable
          loading={loading}
          rows={filteredRepos}
          totalCount={repositories.length}
          sortField={repoSort}
          sortDir={repoDir}
          onSort={handleRepoSort}
        />
      )}
    </Box>
  );
}
