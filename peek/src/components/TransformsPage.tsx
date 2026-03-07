import { useDeferredValue, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import TransformIcon from "@mui/icons-material/Transform";

import { useTransforms } from "../hooks/useTransforms";

import PageHeader from "./PageHeader";
import EmptyState from "./EmptyState";
import { TransformDetailDrawer } from "./transforms/TransformDetailDrawer";
import { TransformKpiCards } from "./transforms/TransformKpiCards";
import { TransformTable } from "./transforms/TransformTable";
import {
  compareTransformRows,
  type SortDirection,
  type SortField,
} from "./transforms/transformSortUtils";

const ALL_STATES = "all";

export default function TransformsPage() {
  const result = useTransforms();
  const loading = result.status === "loading";
  const transforms = useMemo(() => (result.status === "success" ? result.data : []), [result]);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sortField, setSortField] = useState<SortField>("healthStatus");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [stateFilter, setStateFilter] = useState<string>(ALL_STATES);
  const [showOnlyUnhealthy, setShowOnlyUnhealthy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const kpi = useMemo(() => {
    const running = transforms.filter((t) => t.state === "started").length;
    const failed = transforms.filter((t) => t.state === "failed").length;
    const stopped = transforms.filter((t) => t.state === "stopped").length;
    const healthIssues = transforms.filter((t) => t.healthStatus !== "green").length;
    return { total: transforms.length, running, failed, stopped, healthIssues };
  }, [transforms]);

  const filteredRows = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return transforms
      .filter((t) => {
        if (term && !t.id.toLowerCase().includes(term)) return false;
        if (stateFilter !== ALL_STATES && t.state !== stateFilter) return false;
        if (showOnlyUnhealthy) {
          if (
            t.state !== "failed" &&
            t.healthStatus === "green" &&
            t.searchFailures === 0 &&
            t.indexFailures === 0
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        const cmp = compareTransformRows(a, b, sortField);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [transforms, deferredSearch, stateFilter, showOnlyUnhealthy, sortField, sortDir]);

  const selectedRow = useMemo(
    () => transforms.find((t) => t.id === selectedId) ?? null,
    [transforms, selectedId],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, height: "100%", minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <PageHeader
          title="Transforms"
          actions={
            <Button
              size="small"
              variant="outlined"
              onClick={() => result.refresh()}
              disabled={loading}
            >
              Refresh
            </Button>
          }
        />
      </Paper>

      <TransformKpiCards {...kpi} />

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          label="Search by transform ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <TextField
          select
          size="small"
          label="State"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value={ALL_STATES}>All states</MenuItem>
          <MenuItem value="started">Started</MenuItem>
          <MenuItem value="stopped">Stopped</MenuItem>
          <MenuItem value="failed">Failed</MenuItem>
          <MenuItem value="aborting">Aborting</MenuItem>
          <MenuItem value="stopping">Stopping</MenuItem>
        </TextField>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showOnlyUnhealthy}
              onChange={(e) => setShowOnlyUnhealthy(e.target.checked)}
            />
          }
          label="Show only unhealthy"
        />
      </Stack>

      {result.status === "error" && <Alert severity="error">{result.error}</Alert>}

      {loading && <LinearProgress />}

      {result.status === "success" && transforms.length === 0 && (
        <EmptyState
          icon={<TransformIcon sx={{ fontSize: 40 }} />}
          heading="No transforms found"
          description="This cluster has no transforms configured. Transforms let you pivot and aggregate data from source indices into destination indices."
        />
      )}

      {filteredRows.length > 0 && (
        <TransformTable
          rows={filteredRows}
          sortField={sortField}
          sortDir={sortDir}
          selectedId={selectedId}
          onSort={handleSort}
          onSelect={setSelectedId}
        />
      )}

      {result.status === "success" && transforms.length > 0 && filteredRows.length === 0 && (
        <EmptyState
          icon={<TransformIcon sx={{ fontSize: 40 }} />}
          heading="No matching transforms"
          description="Try adjusting your search or filter criteria."
          size="small"
        />
      )}

      <TransformDetailDrawer row={selectedRow} onClose={() => setSelectedId(null)} />
    </Box>
  );
}
