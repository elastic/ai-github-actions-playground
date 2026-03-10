import { useCallback, useDeferredValue, useMemo } from "react";
import Box from "@mui/material/Box";
import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

import { useSnapshotData } from "../hooks/useSnapshotData";

import DataFetchAlert from "./DataFetchAlert";
import PoliciesTable from "./snapshots/PoliciesTable";
import RepositoriesTable from "./snapshots/RepositoriesTable";
import SnapshotsTable from "./snapshots/SnapshotsTable";
import SnapshotsHeader from "./SnapshotsHeader";
import SnapshotsToolbar from "./SnapshotsToolbar";
import {
  SNAPSHOT_TABS,
  SNAPSHOT_SORT_FIELDS,
  POLICY_SORT_FIELDS,
  REPO_SORT_FIELDS,
  SORT_DIRECTIONS,
  filterSnapshots,
  filterPolicies,
  filterRepositories,
} from "./snapshotPageHelpers";
import {
  type SnapshotSortField,
  type PolicySortField,
  type RepositorySortField,
  type SortDirection,
} from "./snapshotSortUtils";

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

  const filteredSnapshots = useMemo(
    () => filterSnapshots(snapshots, deferredSearch, snapSort, snapDir),
    [snapshots, deferredSearch, snapSort, snapDir],
  );
  const filteredPolicies = useMemo(
    () => filterPolicies(policies, deferredSearch, polSort, polDir),
    [policies, deferredSearch, polSort, polDir],
  );
  const filteredRepos = useMemo(
    () => filterRepositories(repositories, deferredSearch, repoSort, repoDir),
    [repositories, deferredSearch, repoSort, repoDir],
  );

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
      <SnapshotsHeader
        activeTab={activeTab}
        loading={loading}
        snapshotCount={snapshots.length}
        successCount={successCount}
        failedCount={failedCount}
        inProgressCount={inProgressCount}
        policyCount={policies.length}
        totalTaken={slmStats?.total_snapshots_taken ?? 0}
        totalFailed={slmStats?.total_snapshots_failed ?? 0}
        retentionRuns={slmStats?.retention_runs ?? 0}
        onRefresh={result.refresh}
      />

      <SnapshotsToolbar
        activeTab={activeTab}
        search={search}
        filterLabel={filterLabel}
        onTabChange={(tab) => void setUrlState({ tab })}
        onSearchChange={(value) => void setUrlState({ q: value })}
      />

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
