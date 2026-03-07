import { useCallback, useDeferredValue, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
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
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import PolicyIcon from "@mui/icons-material/Policy";
import { parseAsBoolean, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

import { useIlm } from "../hooks/useIlm";
import { COMPONENT_HEIGHTS } from "../types/tokens";

import EmptyState from "./EmptyState";
import {
  compareIndexRows,
  comparePolicyRows,
  type IndexSortField,
  type PolicySortField,
  type SortDirection,
} from "./ilmSortUtils";
import PageHeader from "./PageHeader";
import { OverviewInfoCard } from "./OverviewInfoCard";

// Re-export so existing consumers still work
export { parseDurationToMs, compareIndexRows, comparePolicyRows } from "./ilmSortUtils";
export type { IndexSortField, PolicySortField, SortDirection } from "./ilmSortUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ILM_TABS: Array<"indices" | "policies"> = ["indices", "policies"];
const INDEX_SORT_FIELDS: IndexSortField[] = ["index", "policy", "phase", "step", "age", "error"];
const POLICY_SORT_FIELDS: PolicySortField[] = ["name", "version", "modifiedDate", "indexCount"];
const SORT_DIRECTIONS: SortDirection[] = ["asc", "desc"];

const PHASE_COLORS: Record<string, "info" | "success" | "warning" | "error" | "default"> = {
  hot: "error",
  warm: "warning",
  cold: "info",
  frozen: "info",
  delete: "default",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IlmPage() {
  const result = useIlm();
  const loading = result.status === "loading";
  const indexRows = result.status === "success" ? result.data.indexRows : [];
  const policyRows = result.status === "success" ? result.data.policyRows : [];

  const [urlState, setUrlState] = useQueryStates(
    {
      tab: parseAsStringEnum<"indices" | "policies">(ILM_TABS).withDefault("indices"),
      q: parseAsString.withDefault(""),
      onlyErrors: parseAsBoolean.withDefault(false),
      managedOnly: parseAsBoolean.withDefault(false),
      phase: parseAsString.withDefault(""),
      indexSortField: parseAsStringEnum<IndexSortField>(INDEX_SORT_FIELDS).withDefault("error"),
      indexSortDir: parseAsStringEnum<SortDirection>(SORT_DIRECTIONS).withDefault("desc"),
      policySortField: parseAsStringEnum<PolicySortField>(POLICY_SORT_FIELDS).withDefault("name"),
      policySortDir: parseAsStringEnum<SortDirection>(SORT_DIRECTIONS).withDefault("asc"),
    },
    { history: "replace" },
  );

  const activeTab = urlState.tab;
  const search = urlState.q;
  const deferredSearch = useDeferredValue(search);
  const onlyErrors = urlState.onlyErrors;
  const managedOnly = urlState.managedOnly;
  const phaseFilter = urlState.phase;
  const indexSortField = urlState.indexSortField;
  const indexSortDir = urlState.indexSortDir;
  const policySortField = urlState.policySortField;
  const policySortDir = urlState.policySortDir;

  // Index table sort — default: errors first
  const handleIndexSort = useCallback(
    (field: IndexSortField) => {
      const nextDir: SortDirection =
        indexSortField === field && indexSortDir === "asc" ? "desc" : "asc";
      void setUrlState({ indexSortField: field, indexSortDir: nextDir });
    },
    [indexSortField, indexSortDir, setUrlState],
  );

  // Policy table sort
  const handlePolicySort = useCallback(
    (field: PolicySortField) => {
      const nextDir: SortDirection =
        policySortField === field && policySortDir === "asc" ? "desc" : "asc";
      void setUrlState({ policySortField: field, policySortDir: nextDir });
    },
    [policySortField, policySortDir, setUrlState],
  );

  // Detail flyover
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const selectedRow = useMemo(
    () => indexRows.find((r) => r.index === selectedIndex) ?? null,
    [indexRows, selectedIndex],
  );
  const selectedPolicyRow = useMemo(
    () => policyRows.find((r) => r.name === selectedRow?.policy) ?? null,
    [policyRows, selectedRow],
  );

  // Derived metrics
  const errorCount = useMemo(() => indexRows.filter((r) => r.isError).length, [indexRows]);
  const phaseDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    for (const row of indexRows) {
      const p = row.phase || "unknown";
      dist[p] = (dist[p] ?? 0) + 1;
    }
    return dist;
  }, [indexRows]);

  // Filter + sort
  const filteredIndexRows = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const phase = phaseFilter.trim().toLowerCase();
    let filtered = indexRows.filter((r) => {
      if (onlyErrors && !r.isError) return false;
      if (managedOnly && !r.raw?.managed) return false;
      if (phase && r.phase.toLowerCase() !== phase) return false;
      if (!term) return true;
      return r.index.toLowerCase().includes(term) || r.policy.toLowerCase().includes(term);
    });
    filtered = [...filtered].sort((a, b) => compareIndexRows(a, b, indexSortField, indexSortDir));
    return filtered;
  }, [
    indexRows,
    deferredSearch,
    onlyErrors,
    managedOnly,
    phaseFilter,
    indexSortField,
    indexSortDir,
  ]);

  const filteredPolicyRows = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    let filtered = policyRows.filter((r) => {
      if (!term) return true;
      return r.name.toLowerCase().includes(term);
    });
    filtered = [...filtered].sort((a, b) =>
      comparePolicyRows(a, b, policySortField, policySortDir),
    );
    return filtered;
  }, [policyRows, deferredSearch, policySortField, policySortDir]);

  if (result.status === "error") {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{result.error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="ILM Troubleshooting"
          actions={
            <Button
              size="small"
              variant="outlined"
              onClick={result.refresh}
              aria-label={loading ? "Refreshing ILM data" : "Refresh ILM data"}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        />
      </Paper>

      {/* KPI cards */}
      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title="Managed Indices">
            <Typography variant="h5" component="p">
              {indexRows.length}
            </Typography>
          </OverviewInfoCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title="Indices in ERROR">
            <Typography variant="h5" component="p" color={errorCount > 0 ? "error" : undefined}>
              {errorCount}
            </Typography>
          </OverviewInfoCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title="Policies">
            <Typography variant="h5" component="p">
              {policyRows.length}
            </Typography>
          </OverviewInfoCard>
        </Grid>
        <Grid item xs={6} sm={3}>
          <OverviewInfoCard title="Phase Distribution">
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {Object.entries(phaseDistribution).map(([phase, count]) => (
                <Chip
                  key={phase}
                  label={`${phase}: ${count}`}
                  size="small"
                  color={PHASE_COLORS[phase] ?? "default"}
                  variant="outlined"
                />
              ))}
              {Object.keys(phaseDistribution).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  —
                </Typography>
              )}
            </Box>
          </OverviewInfoCard>
        </Grid>
      </Grid>

      {/* Tabs + Search */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => void setUrlState({ tab: v as "indices" | "policies" })}
          sx={{ minHeight: COMPONENT_HEIGHTS.tab }}
        >
          <Tab label="Indices" value="indices" sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }} />
          <Tab label="Policies" value="policies" sx={{ minHeight: COMPONENT_HEIGHTS.tab, py: 0 }} />
        </Tabs>
        <TextField
          size="small"
          placeholder={
            activeTab === "indices" ? "Filter by index or policy..." : "Filter policies..."
          }
          value={search}
          onChange={(e) => void setUrlState({ q: e.target.value })}
          sx={{ minWidth: 260 }}
          aria-label="Filter ILM"
        />
        {activeTab === "indices" && (
          <>
            <TextField
              size="small"
              placeholder="Phase (hot/warm/...)"
              value={phaseFilter}
              onChange={(e) => void setUrlState({ phase: e.target.value })}
              sx={{ minWidth: 180 }}
              aria-label="Filter ILM phase"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={managedOnly}
                  onChange={(e) => void setUrlState({ managedOnly: e.target.checked })}
                />
              }
              label="Managed only"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={onlyErrors}
                  onChange={(e) => void setUrlState({ onlyErrors: e.target.checked })}
                />
              }
              label="Only errors"
            />
          </>
        )}
      </Box>

      {/* Indices table */}
      {activeTab === "indices" && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <TableContainer>
            <Table size="small" stickyHeader aria-label="ILM indices">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={indexSortField === "index"}
                      direction={indexSortField === "index" ? indexSortDir : "asc"}
                      onClick={() => handleIndexSort("index")}
                    >
                      Index
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={indexSortField === "policy"}
                      direction={indexSortField === "policy" ? indexSortDir : "asc"}
                      onClick={() => handleIndexSort("policy")}
                    >
                      Policy
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={indexSortField === "phase"}
                      direction={indexSortField === "phase" ? indexSortDir : "asc"}
                      onClick={() => handleIndexSort("phase")}
                    >
                      Phase
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={indexSortField === "step"}
                      direction={indexSortField === "step" ? indexSortDir : "asc"}
                      onClick={() => handleIndexSort("step")}
                    >
                      Step
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={indexSortField === "age"}
                      direction={indexSortField === "age" ? indexSortDir : "asc"}
                      onClick={() => handleIndexSort("age")}
                    >
                      Age
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={indexSortField === "error"}
                      direction={indexSortField === "error" ? indexSortDir : "asc"}
                      onClick={() => handleIndexSort("error")}
                    >
                      Error
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && indexRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 0, border: 0 }}>
                      <LinearProgress />
                    </TableCell>
                  </TableRow>
                )}
                {filteredIndexRows.map((row) => (
                  <TableRow
                    key={row.index}
                    hover
                    selected={row.index === selectedIndex}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open ILM details for ${row.index}`}
                    onClick={() => setSelectedIndex(row.index)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
                        event.preventDefault();
                        setSelectedIndex(row.index);
                      }
                    }}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                      >
                        {row.index}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.policy}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.phase || "—"}
                        size="small"
                        color={PHASE_COLORS[row.phase] ?? "default"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{row.action || "—"}</TableCell>
                    <TableCell>{row.step || "—"}</TableCell>
                    <TableCell>{row.age || "—"}</TableCell>
                    <TableCell>
                      {row.isError ? (
                        <Chip label="ERROR" size="small" color="error" />
                      ) : (
                        <Chip label="OK" size="small" color="success" variant="outlined" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredIndexRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ border: 0 }}>
                      <EmptyState
                        size="small"
                        icon={<PolicyIcon sx={{ fontSize: 28 }} />}
                        heading="No ILM indices found"
                        description={
                          search || onlyErrors || managedOnly || phaseFilter
                            ? "Try adjusting your filters."
                            : "No ILM-managed indices detected."
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Policies table */}
      {activeTab === "policies" && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <TableContainer>
            <Table size="small" stickyHeader aria-label="ILM policies">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={policySortField === "name"}
                      direction={policySortField === "name" ? policySortDir : "asc"}
                      onClick={() => handlePolicySort("name")}
                    >
                      Policy
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={policySortField === "version"}
                      direction={policySortField === "version" ? policySortDir : "asc"}
                      onClick={() => handlePolicySort("version")}
                    >
                      Version
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={policySortField === "modifiedDate"}
                      direction={policySortField === "modifiedDate" ? policySortDir : "asc"}
                      onClick={() => handlePolicySort("modifiedDate")}
                    >
                      Modified
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Phases</TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={policySortField === "indexCount"}
                      direction={policySortField === "indexCount" ? policySortDir : "asc"}
                      onClick={() => handlePolicySort("indexCount")}
                    >
                      In Use By
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && policyRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 0, border: 0 }}>
                      <LinearProgress />
                    </TableCell>
                  </TableRow>
                )}
                {filteredPolicyRows.map((row) => (
                  <TableRow key={row.name} hover>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                      >
                        {row.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.version}</TableCell>
                    <TableCell>{row.modifiedDate || "—"}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {row.phases.map((p) => (
                          <Chip
                            key={p}
                            label={p}
                            size="small"
                            color={PHASE_COLORS[p] ?? "default"}
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {row.indexCount} indices, {row.dataStreamCount} data streams,{" "}
                      {row.templateCount} templates
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredPolicyRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ border: 0 }}>
                      <EmptyState
                        size="small"
                        icon={<PolicyIcon sx={{ fontSize: 28 }} />}
                        heading="No ILM policies found"
                        description={
                          search ? "Try adjusting your search." : "No ILM policies configured."
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Detail flyover (index-focused) */}
      <Drawer
        anchor="right"
        open={Boolean(selectedRow)}
        onClose={() => setSelectedIndex(null)}
        PaperProps={{
          sx: {
            width: { xs: "100%", md: 560 },
            p: 1,
            backgroundColor: "background.default",
          },
        }}
      >
        {selectedRow && (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 1,
              }}
            >
              <Typography variant="subtitle1">ILM Index Details</Typography>
              <IconButton
                size="small"
                aria-label="Close ILM details"
                onClick={() => setSelectedIndex(null)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1, py: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                INDEX
              </Typography>
              <Typography variant="body2" gutterBottom sx={{ fontFamily: "monospace" }}>
                {selectedRow.index}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                POLICY
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedRow.policy}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                PHASE
              </Typography>
              <Chip
                label={selectedRow.phase || "—"}
                size="small"
                color={PHASE_COLORS[selectedRow.phase] ?? "default"}
                variant="outlined"
                sx={{ mb: 1 }}
              />

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                ACTION
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedRow.action || "—"}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                STEP
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedRow.step || "—"}
              </Typography>

              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                AGE
              </Typography>
              <Typography variant="body2" gutterBottom>
                {selectedRow.age || "—"}
              </Typography>

              {selectedRow.isError && (
                <>
                  <Alert severity="error" sx={{ mt: 1, mb: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      Failed Step: {selectedRow.failedStep}
                    </Typography>
                    <Typography variant="body2">{selectedRow.stepReason}</Typography>
                  </Alert>
                </>
              )}

              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  RAW JSON
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{ p: 1, maxHeight: 300, overflow: "auto", fontSize: "0.75rem" }}
                >
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {JSON.stringify(
                      {
                        explain: selectedRow.raw ?? selectedRow,
                        policy: selectedPolicyRow?.raw ?? null,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </Paper>
              </Box>
            </Box>
          </>
        )}
      </Drawer>
    </Box>
  );
}
