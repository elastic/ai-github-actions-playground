import { useCallback, useDeferredValue, useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import BackupIcon from "@mui/icons-material/Backup";
import { parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

import { useSnapshotData } from "../hooks/useSnapshotData";
import type { SnapshotRow, SlmPolicyRow, RepositoryRow } from "../hooks/useSnapshotData";
import { COMPONENT_HEIGHTS, COMPACT_CHIP_SX } from "../types/tokens";

import EmptyState from "./EmptyState";
import { OverviewInfoCard } from "./OverviewInfoCard";
import PageHeader from "./PageHeader";
import {
  compareSnapshots,
  comparePolicies,
  compareRepositories,
  type SnapshotSortField,
  type PolicySortField,
  type RepositorySortField,
  type SortDirection,
} from "./snapshotSortUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stateColor(state: string): "success" | "error" | "warning" | "info" | "default" {
  switch (state) {
    case "SUCCESS":
      return "success";
    case "FAILED":
      return "error";
    case "PARTIAL":
      return "warning";
    case "IN_PROGRESS":
      return "info";
    default:
      return "default";
  }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(1)}m`;
  const h = m / 60;
  return `${h.toFixed(1)}h`;
}

function formatRelativeTime(ms: number): string {
  if (!ms) return "—";
  const now = Date.now();
  const diff = now - ms;
  if (diff < 0) {
    // Future date
    const absDiff = Math.abs(diff);
    if (absDiff < 60_000) return "in <1m";
    if (absDiff < 3_600_000) return `in ${Math.round(absDiff / 60_000)}m`;
    if (absDiff < 86_400_000) return `in ${Math.round(absDiff / 3_600_000)}h`;
    return `in ${Math.round(absDiff / 86_400_000)}d`;
  }
  if (diff < 60_000) return "<1m ago";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

function summarizeSettings(settings: Record<string, string>): string {
  const preferredKeys = ["bucket", "base_path", "location", "container", "path"];
  const preferred = preferredKeys.filter((k) => settings[k]).map((k) => `${k}: ${settings[k]}`);
  if (preferred.length > 0) return preferred.join(", ");
  const fallback = Object.entries(settings)
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${v}`);
  return fallback.length > 0 ? fallback.join(", ") : "—";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  // Sorting handlers
  const handleSnapSort = useCallback(
    (field: SnapshotSortField) => {
      const d: SortDirection = snapSort === field && snapDir === "asc" ? "desc" : "asc";
      void setUrlState({ snapSort: field, snapDir: d });
    },
    [snapSort, snapDir, setUrlState],
  );
  const handlePolSort = useCallback(
    (field: PolicySortField) => {
      const d: SortDirection = polSort === field && polDir === "asc" ? "desc" : "asc";
      void setUrlState({ polSort: field, polDir: d });
    },
    [polSort, polDir, setUrlState],
  );
  const handleRepoSort = useCallback(
    (field: RepositorySortField) => {
      const d: SortDirection = repoSort === field && repoDir === "asc" ? "desc" : "asc";
      void setUrlState({ repoSort: field, repoDir: d });
    },
    [repoSort, repoDir, setUrlState],
  );

  // Filtered + sorted data
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

  // KPI stats
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

  if (result.status === "error") {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{result.error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      {/* Header */}
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

      {/* KPI Cards */}
      {activeTab === "snapshots" && (
        <Grid container spacing={1}>
          <Grid item xs={6} sm={3}>
            <OverviewInfoCard title="Total Snapshots">
              <Typography variant="h5" component="div">
                {snapshots.length}
              </Typography>
            </OverviewInfoCard>
          </Grid>
          <Grid item xs={6} sm={3}>
            <OverviewInfoCard title="Successful">
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="h5" component="div">
                  {successCount}
                </Typography>
                {successCount > 0 && (
                  <Chip label={successCount} color="success" size="small" sx={COMPACT_CHIP_SX} />
                )}
              </Box>
            </OverviewInfoCard>
          </Grid>
          <Grid item xs={6} sm={3}>
            <OverviewInfoCard title="Failed / Partial">
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="h5" component="div">
                  {failedCount}
                </Typography>
                {failedCount > 0 && (
                  <Chip label={failedCount} color="error" size="small" sx={COMPACT_CHIP_SX} />
                )}
              </Box>
            </OverviewInfoCard>
          </Grid>
          <Grid item xs={6} sm={3}>
            <OverviewInfoCard title="In Progress">
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="h5" component="div">
                  {inProgressCount}
                </Typography>
                {inProgressCount > 0 && (
                  <Chip label={inProgressCount} color="info" size="small" sx={COMPACT_CHIP_SX} />
                )}
              </Box>
            </OverviewInfoCard>
          </Grid>
        </Grid>
      )}

      {activeTab === "policies" && (
        <Grid container spacing={1}>
          <Grid item xs={6} sm={3}>
            <OverviewInfoCard title="Policies">
              <Typography variant="h5" component="div">
                {policies.length}
              </Typography>
            </OverviewInfoCard>
          </Grid>
          <Grid item xs={6} sm={3}>
            <OverviewInfoCard title="Total Taken">
              <Typography variant="h5" component="div">
                {slmStats?.total_snapshots_taken ?? 0}
              </Typography>
            </OverviewInfoCard>
          </Grid>
          <Grid item xs={6} sm={3}>
            <OverviewInfoCard title="Total Failed">
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="h5" component="div">
                  {slmStats?.total_snapshots_failed ?? 0}
                </Typography>
                {(slmStats?.total_snapshots_failed ?? 0) > 0 && (
                  <Chip
                    label={slmStats?.total_snapshots_failed ?? 0}
                    color="error"
                    size="small"
                    sx={COMPACT_CHIP_SX}
                  />
                )}
              </Box>
            </OverviewInfoCard>
          </Grid>
          <Grid item xs={6} sm={3}>
            <OverviewInfoCard title="Retention Runs">
              <Typography variant="h5" component="div">
                {slmStats?.retention_runs ?? 0}
              </Typography>
            </OverviewInfoCard>
          </Grid>
        </Grid>
      )}

      {/* Tabs + filter */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
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
          aria-label="Filter snapshots"
        />
      </Box>

      {/* Snapshots tab */}
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

      {/* Policies tab */}
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

      {/* Repositories tab */}
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

// ---------------------------------------------------------------------------
// Snapshots Table
// ---------------------------------------------------------------------------

interface SnapshotsTableProps {
  loading: boolean;
  rows: SnapshotRow[];
  totalCount: number;
  sortField: SnapshotSortField;
  sortDir: SortDirection;
  onSort: (field: SnapshotSortField) => void;
}

function SnapshotsTable({
  loading,
  rows,
  totalCount,
  sortField,
  sortDir,
  onSort,
}: SnapshotsTableProps) {
  if (!loading && totalCount === 0) {
    return (
      <EmptyState
        icon={<BackupIcon sx={{ fontSize: 40 }} />}
        heading="No snapshots found"
        description="No snapshot repositories are configured, or no snapshots have been taken yet."
      />
    );
  }

  const columns: Array<{ field: SnapshotSortField; label: string }> = [
    { field: "state", label: "State" },
    { field: "name", label: "Snapshot" },
    { field: "repository", label: "Repository" },
    { field: "indexCount", label: "Indices" },
    { field: "startTime", label: "Started" },
    { field: "duration", label: "Duration" },
  ];

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
      <Table size="small" stickyHeader aria-label="Snapshots table">
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.field} sx={{ height: COMPONENT_HEIGHTS.tableRow }}>
                <TableSortLabel
                  active={sortField === col.field}
                  direction={sortField === col.field ? sortDir : "asc"}
                  onClick={() => onSort(col.field)}
                >
                  {col.label}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.repository}/${row.name}`} hover>
              <TableCell>
                <Chip
                  label={row.state}
                  color={stateColor(row.state)}
                  size="small"
                  sx={COMPACT_CHIP_SX}
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2" noWrap>
                  {row.name}
                </Typography>
              </TableCell>
              <TableCell>{row.repository}</TableCell>
              <TableCell>{row.indexCount}</TableCell>
              <TableCell>
                <Tooltip title={row.startTime}>
                  <span>{formatRelativeTime(row.startTimeMs)}</span>
                </Tooltip>
              </TableCell>
              <TableCell>{formatDuration(row.duration)}</TableCell>
            </TableRow>
          ))}
          {loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2, textAlign: "center" }}
                >
                  Loading snapshots…
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ---------------------------------------------------------------------------
// Policies Table
// ---------------------------------------------------------------------------

interface PoliciesTableProps {
  loading: boolean;
  rows: SlmPolicyRow[];
  totalCount: number;
  sortField: PolicySortField;
  sortDir: SortDirection;
  onSort: (field: PolicySortField) => void;
}

function PoliciesTable({
  loading,
  rows,
  totalCount,
  sortField,
  sortDir,
  onSort,
}: PoliciesTableProps) {
  if (!loading && totalCount === 0) {
    return (
      <EmptyState
        icon={<BackupIcon sx={{ fontSize: 40 }} />}
        heading="No SLM policies"
        description="No Snapshot Lifecycle Management policies are configured."
      />
    );
  }

  const columns: Array<{ field: PolicySortField; label: string; sortable: boolean }> = [
    { field: "name", label: "Policy", sortable: true },
    { field: "repository", label: "Repository", sortable: true },
    { field: "nextRun", label: "Next Run", sortable: true },
    { field: "taken", label: "Taken / Failed", sortable: true },
    { field: "lastSuccess", label: "Last Success", sortable: true },
    { field: "lastFailure", label: "Last Failure", sortable: true },
  ];

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
      <Table size="small" stickyHeader aria-label="SLM Policies table">
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.field} sx={{ height: COMPONENT_HEIGHTS.tableRow }}>
                {col.sortable ? (
                  <TableSortLabel
                    active={sortField === col.field}
                    direction={sortField === col.field ? sortDir : "asc"}
                    onClick={() => onSort(col.field)}
                  >
                    {col.label}
                  </TableSortLabel>
                ) : (
                  col.label
                )}
              </TableCell>
            ))}
            <TableCell sx={{ height: COMPONENT_HEIGHTS.tableRow }}>Schedule</TableCell>
            <TableCell sx={{ height: COMPONENT_HEIGHTS.tableRow }}>Retention</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name} hover>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Typography variant="body2" noWrap>
                    {row.name}
                  </Typography>
                  {row.isFailing && (
                    <Chip label="FAILING" color="error" size="small" sx={COMPACT_CHIP_SX} />
                  )}
                </Box>
              </TableCell>
              <TableCell>{row.repository}</TableCell>
              <TableCell>{formatRelativeTime(row.nextExecutionMs)}</TableCell>
              <TableCell>
                {row.snapshotsTaken} /{" "}
                <Typography
                  component="span"
                  variant="body2"
                  color={row.snapshotsFailed > 0 ? "error.main" : "text.primary"}
                >
                  {row.snapshotsFailed}
                </Typography>
              </TableCell>
              <TableCell>{formatRelativeTime(row.lastSuccessTime)}</TableCell>
              <TableCell>
                {row.lastFailureTime ? (
                  <Tooltip title={row.lastFailureDetails || "No details"}>
                    <Typography variant="body2" color="error.main" noWrap sx={{ maxWidth: 200 }}>
                      {formatRelativeTime(row.lastFailureTime)}
                    </Typography>
                  </Tooltip>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {row.schedule || "—"}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {row.expireAfter ? `${row.expireAfter} (${row.minCount}–${row.maxCount})` : "—"}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
          {loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2, textAlign: "center" }}
                >
                  Loading policies…
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ---------------------------------------------------------------------------
// Repositories Table
// ---------------------------------------------------------------------------

interface RepositoriesTableProps {
  loading: boolean;
  rows: RepositoryRow[];
  totalCount: number;
  sortField: RepositorySortField;
  sortDir: SortDirection;
  onSort: (field: RepositorySortField) => void;
}

function RepositoriesTable({
  loading,
  rows,
  totalCount,
  sortField,
  sortDir,
  onSort,
}: RepositoriesTableProps) {
  if (!loading && totalCount === 0) {
    return (
      <EmptyState
        icon={<BackupIcon sx={{ fontSize: 40 }} />}
        heading="No repositories"
        description="No snapshot repositories are configured."
      />
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, minHeight: 0 }}>
      <Table size="small" stickyHeader aria-label="Repositories table">
        <TableHead>
          <TableRow>
            <TableCell sx={{ height: COMPONENT_HEIGHTS.tableRow }}>
              <TableSortLabel
                active={sortField === "name"}
                direction={sortField === "name" ? sortDir : "asc"}
                onClick={() => onSort("name")}
              >
                Repository
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ height: COMPONENT_HEIGHTS.tableRow }}>
              <TableSortLabel
                active={sortField === "type"}
                direction={sortField === "type" ? sortDir : "asc"}
                onClick={() => onSort("type")}
              >
                Type
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ height: COMPONENT_HEIGHTS.tableRow }}>Settings</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name} hover>
              <TableCell>
                <Typography variant="body2" noWrap>
                  {row.name}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip label={row.type} size="small" sx={COMPACT_CHIP_SX} />
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 400 }}>
                  {summarizeSettings(row.settings)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
          {loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={3}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2, textAlign: "center" }}
                >
                  Loading repositories…
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
