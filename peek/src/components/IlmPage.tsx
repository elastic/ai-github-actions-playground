import { useCallback, useDeferredValue, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import { parseAsBoolean, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";

import { useIlm } from "../hooks/useIlm";
import type { IlmPolicyRow } from "../services/es/ilmTypes";
import { COMPONENT_HEIGHTS } from "../types/tokens";

import IlmIndexDetailDrawer from "./IlmIndexDetailDrawer";
import IlmIndicesTable from "./IlmIndicesTable";
import IlmKpiCards from "./IlmKpiCards";
import IlmPoliciesTable from "./IlmPoliciesTable";
import IlmPolicyDetailDrawer from "./IlmPolicyDetailDrawer";
import {
  compareIndexRows,
  comparePolicyRows,
  type IndexSortField,
  type PolicySortField,
  type SortDirection,
} from "./ilmSortUtils";
import PageHeader from "./PageHeader";

// Re-export so existing consumers still work
export { parseDurationToMs, compareIndexRows, comparePolicyRows } from "./ilmSortUtils";
export type { IndexSortField, PolicySortField, SortDirection } from "./ilmSortUtils";

const ILM_TABS: Array<"indices" | "policies"> = ["indices", "policies"];
const INDEX_SORT_FIELDS: IndexSortField[] = ["index", "policy", "phase", "step", "age", "error"];
const POLICY_SORT_FIELDS: PolicySortField[] = ["name", "version", "modifiedDate", "indexCount"];
const SORT_DIRECTIONS: SortDirection[] = ["asc", "desc"];

export default function IlmPage() {
  const result = useIlm();
  const loading = result.status === "loading";
  const resultData = result.status === "success" ? result.data : null;
  const indexRows = useMemo(() => resultData?.indexRows ?? [], [resultData]);
  const policyRows = useMemo(() => resultData?.policyRows ?? [], [resultData]);

  const [urlState, setUrlState] = useQueryStates(
    {
      tab: parseAsStringEnum<"indices" | "policies">(ILM_TABS).withDefault("policies"),
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

  const { tab: activeTab, q: search, onlyErrors, managedOnly, phase: phaseFilter } = urlState;
  const { indexSortField, indexSortDir, policySortField, policySortDir } = urlState;
  const deferredSearch = useDeferredValue(search);

  const handleIndexSort = useCallback(
    (field: IndexSortField) => {
      const dir: SortDirection =
        indexSortField === field && indexSortDir === "asc" ? "desc" : "asc";
      void setUrlState({ indexSortField: field, indexSortDir: dir });
    },
    [indexSortField, indexSortDir, setUrlState],
  );
  const handlePolicySort = useCallback(
    (field: PolicySortField) => {
      const dir: SortDirection =
        policySortField === field && policySortDir === "asc" ? "desc" : "asc";
      void setUrlState({ policySortField: field, policySortDir: dir });
    },
    [policySortField, policySortDir, setUrlState],
  );

  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const selectedRow = useMemo(
    () => indexRows.find((r) => r.index === selectedIndex) ?? null,
    [indexRows, selectedIndex],
  );
  const selectedPolicyRow = useMemo(
    () => policyRows.find((r) => r.name === selectedRow?.policy) ?? null,
    [policyRows, selectedRow],
  );
  const [selectedPolicy, setSelectedPolicy] = useState<IlmPolicyRow | null>(null);

  const errorCount = useMemo(() => indexRows.filter((r) => r.isError).length, [indexRows]);
  const phaseDistribution = useMemo(() => {
    const d: Record<string, number> = {};
    for (const r of indexRows) d[r.phase || "unknown"] = (d[r.phase || "unknown"] ?? 0) + 1;
    return d;
  }, [indexRows]);

  const filteredIndexRows = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const ph = phaseFilter.trim().toLowerCase();
    return [...indexRows]
      .filter((r) => {
        if (onlyErrors && !r.isError) return false;
        if (managedOnly && !r.raw?.managed) return false;
        if (ph && r.phase.toLowerCase() !== ph) return false;
        return (
          !term || r.index.toLowerCase().includes(term) || r.policy.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => compareIndexRows(a, b, indexSortField, indexSortDir));
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
    return [...policyRows]
      .filter((r) => !term || r.name.toLowerCase().includes(term))
      .sort((a, b) => comparePolicyRows(a, b, policySortField, policySortDir));
  }, [policyRows, deferredSearch, policySortField, policySortDir]);

  if (result.status === "error") {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{result.error}</Alert>
      </Box>
    );
  }

  const hasFilters = Boolean(search || onlyErrors || managedOnly || phaseFilter);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Index Lifecycle Management"
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
      <IlmKpiCards
        indexCount={indexRows.length}
        errorCount={errorCount}
        policyCount={policyRows.length}
        phaseDistribution={phaseDistribution}
      />
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
      {activeTab === "indices" && (
        <IlmIndicesTable
          loading={loading}
          totalCount={indexRows.length}
          filteredRows={filteredIndexRows}
          selectedIndex={selectedIndex}
          sortField={indexSortField}
          sortDir={indexSortDir}
          onSort={handleIndexSort}
          onSelect={setSelectedIndex}
          hasFilters={hasFilters}
        />
      )}
      {activeTab === "policies" && (
        <IlmPoliciesTable
          loading={loading}
          totalCount={policyRows.length}
          filteredRows={filteredPolicyRows}
          selectedPolicy={selectedPolicy}
          sortField={policySortField}
          sortDir={policySortDir}
          onSort={handlePolicySort}
          onSelect={setSelectedPolicy}
          search={search}
        />
      )}
      <IlmIndexDetailDrawer
        selectedRow={selectedRow}
        selectedPolicyRow={selectedPolicyRow}
        onClose={() => setSelectedIndex(null)}
      />
      <IlmPolicyDetailDrawer policy={selectedPolicy} onClose={() => setSelectedPolicy(null)} />
    </Box>
  );
}
