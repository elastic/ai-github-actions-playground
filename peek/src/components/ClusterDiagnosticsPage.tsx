import { useCallback, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

import type { HealthReportIndicator } from "../services/es";

import PageHeader from "./PageHeader";
import DiagnosticsDetailDrawer from "./cluster-diagnostics/DiagnosticsDetailDrawer";
import DiagnosticsIndicatorTable from "./cluster-diagnostics/DiagnosticsIndicatorTable";
import { useHealthReport } from "./cluster-diagnostics/useHealthReport";

import type { DiagnosticsIndicatorRow } from "./cluster-diagnostics/DiagnosticsDetailDrawer";
import type { SortField } from "./cluster-diagnostics/DiagnosticsIndicatorTable";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type IndicatorStatus = "green" | "yellow" | "red" | "unknown";

function indicatorStatusColor(
  status: IndicatorStatus | undefined,
): "success" | "warning" | "error" | "default" {
  if (status === "green") return "success";
  if (status === "yellow") return "warning";
  if (status === "red") return "error";
  return "default";
}

const STATUS_RANK: Record<string, number> = { red: 0, yellow: 1, green: 2, unknown: 3 };

function humanizeIndicatorName(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function worstSeverity(indicator: HealthReportIndicator): number {
  if (!indicator.impacts?.length) return 0;
  return Math.max(...indicator.impacts.map((i) => i.severity ?? 0));
}

// ---------------------------------------------------------------------------
// Row type
// ---------------------------------------------------------------------------

interface IndicatorRow extends DiagnosticsIndicatorRow {
  impactsCount: number;
  diagnosesCount: number;
  worstSeverity: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClusterDiagnosticsPage() {
  const { report, loading, error, refresh } = useHealthReport();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField],
  );

  const rows: IndicatorRow[] = useMemo(() => {
    if (!report?.indicators) return [];
    return Object.entries(report.indicators).map(([key, ind]) => ({
      key,
      name: humanizeIndicatorName(key),
      status: (ind.status ?? "unknown") as IndicatorStatus,
      symptom: ind.symptom ?? "",
      impactsCount: ind.impacts?.length ?? 0,
      diagnosesCount: ind.diagnosis?.length ?? 0,
      worstSeverity: worstSeverity(ind),
      indicator: ind,
    }));
  }, [report]);

  const filteredRows = useMemo(() => {
    const term = filterText.toLowerCase();
    const filtered = term
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(term) ||
            r.symptom.toLowerCase().includes(term) ||
            r.key.toLowerCase().includes(term),
        )
      : rows;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "status":
          cmp = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "impactsCount":
          cmp = a.impactsCount - b.impactsCount;
          break;
        case "diagnosesCount":
          cmp = a.diagnosesCount - b.diagnosesCount;
          break;
        case "worstSeverity":
          cmp = a.worstSeverity - b.worstSeverity;
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [rows, filterText, sortField, sortDir]);

  const selectedIndicator = useMemo(
    () => (selectedKey ? (rows.find((r) => r.key === selectedKey) ?? null) : null),
    [rows, selectedKey],
  );

  const kpis = useMemo(() => {
    const total = rows.length;
    const issues = rows.filter((r) => r.status !== "green").length;
    const totalImpacts = rows.reduce((sum, r) => sum + r.impactsCount, 0);
    return { total, issues, totalImpacts };
  }, [rows]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Cluster Diagnostics"
          actions={
            <Button size="small" variant="outlined" onClick={refresh} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          }
        />
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Chip
          color={indicatorStatusColor(report?.status as IndicatorStatus | undefined)}
          label={`Status: ${report?.status?.toUpperCase() ?? "—"}`}
        />
        <Chip label={`Indicators: ${kpis.total}`} variant="outlined" />
        <Chip color={kpis.issues > 0 ? "warning" : "default"} label={`Issues: ${kpis.issues}`} />
        <Chip label={`Total Impacts: ${kpis.totalImpacts}`} variant="outlined" />
      </Stack>

      <TextField
        size="small"
        placeholder="Filter indicators..."
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        sx={{ maxWidth: 360 }}
        aria-label="Filter indicators"
      />

      <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <DiagnosticsIndicatorTable
          rows={filteredRows}
          loading={loading}
          filterText={filterText}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          onSelect={setSelectedKey}
        />
      </Paper>

      <DiagnosticsDetailDrawer selected={selectedIndicator} onClose={() => setSelectedKey(null)} />
    </Box>
  );
}
